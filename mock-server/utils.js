const flatten = arrays => Array.prototype.concat.apply([], arrays);

exports.getAllDataOfTypeFrom =
  confData => dataType =>
    flatten(Object.values(confData).map(data => data[dataType]));

exports.langMap = {
  'zh-TW': 'ZH_TW',
  en: 'EN',
};
