const R = require("ramda");
const pos = require('pos')

const counts_hash = require("./data/count.json");
const pos_count = require('./data/count_pos.json')
const pos_freq = require('./data/freq_pos.json')


const findNextsWord = (counts, pos_freqs, pos_counts, prefix) => {
  // Find what has followed the prefix
  // given our entire corpus
  const next_word_frequencies = counts[prefix] || {};

  const tagger = new pos.Tagger();
  const taggedWords = tagger.tag([prefix]);
  const [_, p] = taggedWords[0]
  const next_pos_frequencies = pos_counts[p]

  const next_words_by_pos = R.reduce((a, c) => {
    const tagger = new pos.Tagger();
    const taggedWords = tagger.tag([c]);
    const [[_, p]] = taggedWords
    if (p in a) {
      a[p] = {
        ...a[p],
        options: a[p].options.concat(c),
        count: next_word_frequencies[c] + a[p].count
      }
    } else {
      a[p] = {
        options: [c],
        count: next_word_frequencies[c]
      }
    }

    return a
  }, {}, Object.keys(next_word_frequencies))

  const pos_parts = Object.keys(next_words_by_pos);

  const choices = R.flatten(
    pos_parts.map(p =>
      Array.from({ length: next_words_by_pos[p].count }, () => next_words_by_pos[p].options)
    )
  );

  if (!choices.length) {
    return "__EMPTY__";
  }

  return choices[Math.floor(Math.random() * choices.length)];
};



const Prefix = "I";
let tweet = "";
let last_word = Prefix;
// whi
while (
  // it is not over the 280 chars
  tweet.length < 280 &&
  // it is not closed by EMPTY
  last_word !== "__EMPTY__"
) {
  last_word = findNextsWord(counts_hash, pos_freq, pos_count, last_word);
  tweet += " " + last_word;
}

console.dir(`${Prefix}${tweet}`.replace("__EMPTY__", "").trim());
