const express = require('express');
const { graphqlExpress } = require('apollo-server-express');
const bodyParser = require('body-parser');
const mockServer = require('./mock-server/index');

const app = express();

app.use('/graphql', bodyParser.json(), graphqlExpress({ schema: mockServer.schema }));

exports.graphql = (request, response) => {
  request.url = '/graphql';
  request.path = '/graphql';
  request.method = 'POST';
  app(request, response);
};
