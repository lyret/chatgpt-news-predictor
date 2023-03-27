# Tomorrow's News, Today!

## A ChatGPT news predictor

![](https://lh5.googleusercontent.com/azCX6GY9dfGXCiAg4TZrosEFE7RYx8bLNlpY0B3gfG8e0H6ghset7r_69694idw2Ouuiw0AxCOFXedM0LoI_jde3asL7jULsG2NjgU9AbQYgCD9OWj8vSVSsoLChTE-_Bw=w1020)

_note: all news-sources, prompt, and text material are in Swedish, documentation in english_

This is a small example program that shows how prompt engineering can be done using the ChatGPT API and external text sources. Every day ChatGPT generates the news headlines for the following day, by continuing the events of the current day.

It works the following way

- It fetches news headlines from the RSS feed of The Swedish television bureau, SVT.
- These headlines are used to generate a prompt for ChatGTP where future events will be predicted.
- ChatGPT responds with news headlines for tomorrow, from which a newsletter email is created.
- Lastly email subscribers are fetched from a google spreadsheet document, and are sent the newly created newspapper.

This is run as a CRON job 07:30 AM everyday.

## Usage

You can sign up for the newsletter at [news.lyresten.se](https://news.lyresten.se).

## Background and motivation

Like everybody else I been thinking and tinkering a lot with ChatGPT, and I wanted to produce something tangible. One idea that I been thinking about for interesting integrations is having ChatGPT being the one contacting you. Hope you'll find this inspiring.

## Development

1. Install dependencies

   `npm ci`

2. Rename `env.example` to `.env` and enter the correct values for each field, only the API key for ChatGPT is neccessary for generating news stories - if you don't want to use this as an email service some minor modifications are neccessary.

3. Test the service

   `node index.mjs test <your@email.address>`

Enjoy ❤️
Lyret
