# tweeter

> Let's make a bot that sounds like Mr Trump

## Overview

At the end of this, we will have a working "bot" that can "create" "Tweets" based on Mr Trumps'
past tweets

### Step 1: Grab Input Data

- [This site](http://trumptwitterarchive.com/archive) seems to have an archive
- Export it however you want. We did it as `json` and copy-pasted into `data/raw.json`

### Step 2: Read Data into JS

```javascript
const raw_data = require("./data/raw.json");

// How many tweets do we have?
// but add them commas or periods
// depending on where I live
console.log(raw_data.length.toLocaleString());
```

As of the time of writing, it was `42,932`. ALMOST 43 THOUSAND TWEETS!

### Step 3: Slice and Dice

Once we have the data in Javascript, let's start slicing and dicing this data, to see what it looks like.

First, let's take the first 5 items, just to get a sampling of what it look slike

```javascript
const R = require("ramda");

const first5 = R.take(5, raw_data);

console.dir(first5);
```

should output something along the lines of

```json
[
  {
    "source": "Twitter for iPhone",
    "text": "Pushed hard to have Apple build in USA! https://t.co/BRfXBkJdc2",
    "created_at": "Sun Nov 24 04:53:36 +0000 2019",
    "retweet_count": 6286,
    "favorite_count": 26151,
    "is_retweet": false,
    "id_str": "1198464662960066560"
  },
  {
    "source": "Twitter for iPhone",
    "text": "https://t.co/XexXL5HYRU",
    "created_at": "Sun Nov 24 04:21:43 +0000 2019",
    "retweet_count": 6181,
    "favorite_count": 17043,
    "is_retweet": false,
    "id_str": "1198456640011415552"
  },
  {
    "source": "Twitter for iPhone",
    "text": "https://t.co/x7ATRLwGpY",
    "created_at": "Sun Nov 24 04:20:43 +0000 2019",
    "retweet_count": 4186,
    "favorite_count": 12835,
    "is_retweet": false,
    "id_str": "1198456385157128193"
  },
  {
    "source": "Twitter for iPhone",
    "text": "https://t.co/iSzJDM7CZw",
    "created_at": "Sun Nov 24 04:19:10 +0000 2019",
    "retweet_count": 5010,
    "favorite_count": 14574,
    "is_retweet": false,
    "id_str": "1198455998199091201"
  },
  {
    "source": "Twitter for iPhone",
    "text": "95% Approval Rate in the Republican Party, a record! Thank you!",
    "created_at": "Sat Nov 23 22:57:15 +0000 2019",
    "retweet_count": 20845,
    "favorite_count": 105912,
    "is_retweet": false,
    "id_str": "1198374984902676480"
  }
]
```

Seems like most of their tweets are "quote tweets", indicated by the `https://t.co/` prefix on links. Let's filter out
all tweets that are "quote tweets" and see how many we have left

```javascript
// 36,854
console.log(
  R.filter(
    R.compose(R.not, R.propSatisfies(R.contains("https://t.co/"), "text")),
    raw_data
  ).length.toLocaleString()
);
```

Since the "quote tweet" is less likely than a "regular" tweet, any "smart" worker would not include it in its regular
"creation" so we can savely remove it for our testing

```javascript
const actual_tweets = R.filter(
  R.compose(R.not, R.propSatisfies(R.contains("https://t.co/"), "text")),
  raw_data
);
```

But how many of those "actual tweets" are retweets?

```javascript
console.log(
  R.filter(
    R.compose(R.propEq(true, "is_retweet")),
    actual_tweets
  ).length.toLocaleString()
);
```

It says 0! Hmmm. that seems weird but okay. Let's look for tweets that start with RT

```javascript
const text = R.map(R.prop("text"), actual_tweets);
const actual_tweet_text = R.filter(val => R.indexOf("RT", val) !== 0);
console.dir(actual_tweet_text);
```

That sounds about right.

### Step 3: Grams, Lots and Lots of Grams

Now that we have a list of their tweets and only their tweets, we can start massaging the data
into [`n-grams`](https://en.wikipedia.org/wiki/N-gram). We are using n-grams here so that we can
keep track of what word(s) follow what other words in order to be able to "create" new posts.

_**n-gram letters**_

Let's start with a binary-gram for letters for the first 10 tweets:

```javascript
const text = R.map(R.prop("text"), actual_tweets);
const actual_tweet_text = R.filter(val => R.indexOf("RT", val) !== 0, text);
const first10 = R.take(10, actual_tweet_text);

const makeNgram = (n, list, sep = " ") => {
  if (!n || n < 1) {
    throw new Error("You must give a number higher than 0");
  }

  if (!list) {
    throw new Error("You must give me a list of things to gram-ify");
  }

  return list.reduce((a, c, i, arr) => {
    // If we are at the end, we won't get
    // all the needed values
    const possibleNextValues = arr.slice(i + 1, i + n);

    // so we can fill it in
    const nextValues = Array.from(
      { length: n - 1 },
      (_, j) => possibleNextValues[j] || "__EMPTY__"
    );

    const gram = [c, ...nextValues];
    return [...a, gram.join(sep)];
  }, []);
};

const just_words = R.map(R.split(/\s/), first10);

console.log(R.map(list => makeNgram(2, list), just_words));
```

### Step 4: Count N-grams

Now that we have some bi-grams, let's reduce all of them into a single count across multiple
documents. This way, we can see how often each prefix comes up, how often it is followed by
a suffix, etc.

```javascript
const bigrams = R.map(list => makeNgram(2, list), just_words);

// Gets the count of the times a given
// n-gram suffix follows a given n-gram
// prefix
const get_suffix_count = grams => {
  const cache = {};

  for (let i = 0; i < grams.length; i++) {
    const gram = grams[i];

    const nextItem = grams[i + 1] ? grams[i + 1] : "__EMPTY__";

    if (cache[gram]) {
      if (cache[gram][nextItem]) {
        cache[gram][nextItem]++;
        continue;
      }

      cache[gram] = {
        ...cache[gram],
        [nextItem]: 1
      };
      continue;
    }

    cache[gram] = {
      [nextItem]: 1
    };
  }

  return cache;
};

// Gets amount of times a specific gram was used
const get_frequency_gram = grams => {
  const cache = {};
  for (let i = 0; i < grams.lenght; i++) {
    // case insensitive
    const gram = grams[i].toLowerCase();
    cache[gram] = (cache[gram] || 0) + 1;
  }

  return cache;
};
```

and since this will take awhile to do for _all_ of their tweets, let's save the values into some
json file

```javascript
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");

const writeFile = promisify(fs.writeFile);

writeFile(
  path.resolve(__dirname, "data", "freq.json"),
  JSON.stringify(freq_hash, null, 2)
)
  .then(() =>
    writeFile(
      path.resolve(__dirname, "data", "count.json"),
      JSON.stringify(counts_hash, null, 2)
    )
  )
  .then(console.log);
```

### Step 5: Make Random Guesses

Now that we have the counts and frequencies, we can start making random guesses as to what
the next word should be!

```javascript
const freq_hash = require("./data/freq.json");
const counts_hash = require("./data/count.json");

const findNextsWord = (freqs, counts, prefix) => {
  // Find what has followed the prefix
  // given our entire corpus
  const next_word_frequencies = counts[prefix] || {};
  const count_hash = {};

  for (const [suffix, frequencies] of Object.entries(next_word_frequencies)) {
    count_hash[suffix] = frequencies;
  }

  const word_freq = {};

  for (const [key] of Object.entries(count_hash)) {
    // Find how many times this word/hprase has been chosen
    // given our entire corpus
    word_freq[key] = freqs[key.toLowerCase()];
  }

  const words = Object.keys(word_freq);

  return words[Math.floor(Math.random() * words.length)];
};

const Prefix = "Wife";
let tweet = "";
let last_word = Prefix;
// whi
while (
  // it is not over the 280 chars
  tweet.length < 280 &&
  // it is not closed by EMPTY
  last_word !== "__EMPTY__"
) {
  last_word = findNextsWord(freq_hash, counts_hash, last_word);
  tweet += " " + last_word;
}

console.dir(`${Prefix}${tweet}`.replace("__EMPTY__", "").trim());
```
