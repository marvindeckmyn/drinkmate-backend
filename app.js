var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const cors = require('cors');
const usersRouter = require('./routes/users');
const gamesRouter = require('./routes/games');
const categoriesRouter = require('./routes/categories');
const languagesRouter = require('./routes/languages');
const submittedGamesRouter = require('./routes/submittedGames');

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());

app.use('/api/users', usersRouter);
app.use('/api/games', gamesRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/languages', languagesRouter);
app.use('/api/submitted/games', submittedGamesRouter);

module.exports = app;
