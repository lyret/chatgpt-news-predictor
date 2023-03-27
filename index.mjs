import NodeMailer from "nodemailer";
import Day from "dayjs";
import Scheduler from "node-schedule";
import { ChatGPTAPI } from "chatgpt";
import * as DotENV from "dotenv";
import { extract } from "@extractus/feed-extractor";
import { program } from "commander";
import "dayjs/locale/sv.js";

// SETUP ---------------

// Load .env definitions
DotENV.config();

// Make sure dates are formatted in Swedish
Day.locale("sv");

// GLOBAL VARIABLES ---------------

/** Interval at which to generate and send newsletters */
const CRON_INTERVAL = "30 8 * * *";

/** Newsfeed to use for predictions */
const RSS_NEWS_FEED = "http://www.svt.se/nyheter/rss.xml";

/** SMTP server address */
const MAIL_HOST = process.env.MAIL_HOST;

/** Username for authenticating to the SMTP server */
const MAIL_USERNAME = process.env.MAIL_USERNAME;

/** Password for authenticating to the SMTP server */
const MAIL_PASSWORD = process.env.MAIL_PASSWORD;

/** API Key to ChatGPT */
const GPT_API_KEY = process.env.GPT_API_KEY;

/** Url to a CSV file to fetch newsletter subscribers from */
const SUBSCRIBER_CSV_URL = process.env.SUBSCRIBER_CSV_URL;

/** Will be set when performing a test run */
let CLI_GIVEN_EMAIL = "";

/** SMPT transporter for sending email newsletters */
const MailTransporter = NodeMailer.createTransport({
  host: MAIL_HOST,
  port: 465,
  secure: true,
  auth: {
    user: MAIL_USERNAME,
    pass: MAIL_PASSWORD,
  },
  logger: false,
  debug: false,
});

/** Authenticated connection to the Chat GPT API */
const ChatGPTConnection = new ChatGPTAPI({
  apiKey: GPT_API_KEY,
});

// FUNCTIONS ---------------

/** Log function that includes current date & time, for debugging while running as a service */
function log(...msg) {
  console.log(Day().format("MMM D, YYYY h:mm A"), ...msg);
}

/** Calls the ChatGPT API until a parsable response is returned */
async function generateNews(prompt) {
  const { text } = await ChatGPTConnection.sendMessage(prompt);
  const newsStories = text
    .split("\n")
    .filter((t) => t.indexOf("* ") >= 0 && t.indexOf("Nyheter från dagen") < 0)
    .map((t) => t.substring(2));

  if (!newsStories.length) {
    log("Got a bad response, trying again!");
    return await generateNews(prompt);
  }
  return newsStories;
}

/** Returns the signed-up email addresses from the google spreadsheet */
async function getNewsletterReceivers() {
  if (CLI_GIVEN_EMAIL) {
    log("Using the given receiver", CLI_GIVEN_EMAIL);
    return CLI_GIVEN_EMAIL;
  }

  const result = await fetch(SUBSCRIBER_CSV_URL);
  const csv = await result.text();
  const rows = csv.split("\n");
  rows.shift();

  return rows
    .map((row) => {
      const [_, email] = row.split(",");
      let text = email.trim();
      if (text[0] == '"') {
        text = text.slice(1, -1);
      }
      return email;
    })
    .join(",");
}

/** Generate text and html email templates to send using the given news stories */
function generateEmailTemplate(newsStories) {
  const tomorrow = Day()
    .startOf("day")
    .add(1, "day")
    .format("dddd, DD MMMM YYYY");
  const subject = `Nyheter för imorgon, ${tomorrow}`;
  return {
    subject,
    text: `${subject}\n\nHej kära prenumerant! Här följer nyheter för imorgon, ${tomorrow}. Tänk på att alla nyheter är ungefärliga de första 24 timmarna innan inträffande.\n\n* ${newsStories.join(
      "\n\n * "
    )}\n\nTack för att du prenumererar på NYHETER IMORGON\nVi tror att det är viktigt att ha tillgång till pålitlig och relevant information i dagens snabbt föränderliga värld, och vi är glada att kunna erbjuda dig detta nyhetsbrev som en del av vår strävan efter att hålla dig uppdaterad och för-informerad.\n\nMvh\nChatGPT\nAnsvarig redaktör för Nyheter Imorgon\n`,
    html: `<!DOCTYPE html>
    <html>
    <head>
      <title>${subject}</title>
      <meta charset="UTF-8">
      <style>
      
      img {
        width: 100%;
      }
      </style>
    </head>
    <body>
      <header>
        <h1>${subject}</h1>
        <p>Hej kära prenumerant! Här följer nyheterna för vad som sker i världen imorgon, ${tomorrow}. Tänk på att alla nyheter är ungefärliga de första 24 timmarna innan inträffande.</p>
      </header>
      <img src="https://lh5.googleusercontent.com/azCX6GY9dfGXCiAg4TZrosEFE7RYx8bLNlpY0B3gfG8e0H6ghset7r_69694idw2Ouuiw0AxCOFXedM0LoI_jde3asL7jULsG2NjgU9AbQYgCD9OWj8vSVSsoLChTE-_Bw=w1020">
      <main>
      <ul>
          <li><h4>${newsStories.join("</h4></li><li><h4>")}</h4></li>
      </ul>
          <br>
      </main>
      <footer>
        <p>Tack för att du prenumererar på <b>Nyheter Imorgon</b>.</p>
        <p>Vi tror att det är viktigt att ha tillgång till pålitlig och relevant information i dagens snabbt föränderliga värld, och vi är glada att kunna erbjuda dig detta nyhetsbrev som en del av vår strävan efter att hålla dig uppdaterad och för-informerad.
        <br><br>Mvh
        <br>ChatGPT
        <br>Ansvarig redaktör för Nyheter Imorgon</p>
      </footer>
    </body>
    </html>`,
  };
}

/** Main function, is run periodicly or once as a test*/
async function createAndSendNewsletter() {
  log("Reading todays news...");
  const { entries } = await extract(RSS_NEWS_FEED);
  const stories = entries
    .splice(0, 8)
    .map((e) => ` * ${e.title}`)
    .join("\n");
  const prompt = `Här är en lista över olika berättelser:\n${stories}\n\nSkriv fantasifulla berättelser som fortsätter efter varje historia och presentera dem som en lista av morgondagens nyheter. Använd 1 rad per nyhetsrubrik`;
  log("Predicting tomorrows news...");
  const newsStories = await generateNews(prompt);
  log("Getting email subscribers...");
  const emailReceivers = await getNewsletterReceivers();
  log("Generating email to send...");
  const { subject, text, html } = generateEmailTemplate(newsStories);

  const mailResults = await MailTransporter.sendMail({
    from: `Nyheter Imorgon ${MAIL_USERNAME}`,
    to: "",
    bcc: emailReceivers,
    subject,
    text,
    html,
  });

  for (const accepted of mailResults.accepted) {
    log("Sent a newsletter to", accepted.toString());
  }
}

// PROGAM DEFINITION ---------------

program
  .name("ChatGTP News Predictor")
  .description("Generates tommorows news and send them as an email newsletter");

// Tests to a single email address
program
  .command("test")
  .description("Generate and send a newsletter immidiatly to the given address")
  .argument("<string>", "email address to send to")
  .action((email) => {
    CLI_GIVEN_EMAIL = email;
    createAndSendNewsletter();
  });

// Starts the server
program
  .command("start", { isDefault: true })
  .description("Start the server that sends emails using the CRON config")
  .action(() => {
    log("News server started!");
    Scheduler.scheduleJob(CRON_INTERVAL, createAndSendNewsletter);
  });

// PROGRAM EXECUTION ---------------

program.program.parse();
