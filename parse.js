const R = require("ramda");
const raw_data = require("./data/raw.json");
const actual_tweets = R.filter(
  R.compose(R.not, R.propSatisfies(R.contains("https://t.co/"), "text")),
  raw_data
);
const text = R.map(R.prop("text"), actual_tweets);
const actual_tweet_text = R.filter(val => R.indexOf("RT", val) !== 0, text);

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

const just_words = R.map(R.split(/\s/), actual_tweet_text);

const listOGrams = R.map(list => makeNgram(1, list), just_words);

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
  for (let i = 0; i < grams.length; i++) {
    // case insensitive
    const gram = grams[i].toLowerCase();
    cache[gram] = (cache[gram] || 0) + 1;
  }

  return cache;
};

const fs = require("fs");
const path = require("path");
const { promisify } = require("util");

const reduceCounts = R.reduce((a, c) => {
  for (const [prefix, counts] of Object.entries(c)) {
    if (!(prefix in a)) {
      a[prefix] = {};
    }

    for (const [suffix, count] of Object.entries(counts)) {
      if (suffix in a[prefix]) {
        a[prefix][suffix] = count + a[prefix][suffix];
      } else {
        a[prefix][suffix] = count;
      }
    }
  }

  return a;
}, {});

const frequencies = R.map(get_frequency_gram, listOGrams);

const counts = R.map(get_suffix_count, listOGrams);
const reduceFreq = R.reduce((a, c) => {
  for (const [key, count] of Object.entries(c)) {
    if (key in a) {
      a[key] = count + a[key];
    } else {
      a[key] = count;
    }
  }

  return a;
}, {});
const freq_hash = reduceFreq(frequencies);
const counts_hash = reduceCounts(counts);
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
