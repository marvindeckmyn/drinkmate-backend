const category = require('./category');
const game = require('./game');
const necessity = require('./necessity');
const language = require('./language');
const gameTranslation = require('./gameTranslation');
const necessityTranslation = require('./necessityTranslation');
const categoryTranslation = require('./categoryTranslation');
const user = require('./user');

const syncAll = async () => {
  await user.createTable();
  await category.createTable();
  await game.createTable();
  await necessity.createTable();
  await language.createTable();
  await language.addLanguages();
  await gameTranslation.createTable();
  await necessityTranslation.createTable();
  await categoryTranslation.createTable();
};

syncAll();
