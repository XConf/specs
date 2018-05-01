const express = require('express');
const { graphqlExpress, graphiqlExpress } = require('apollo-server-express');
const bodyParser = require('body-parser');
const mockServer = require('./mock-server/index');

const app = express();

app.use('/graphql', bodyParser.json(), graphqlExpress({ schema: mockServer.schema }));
app.get('/graphiql', graphiqlExpress({ endpointURL: '/graphql' }));

exports.graphql = (request, response) => {
  request.url = '/graphql';
  request.path = '/graphql';
  request.method = 'POST';
  app(request, response);
};

exports.graphiql = (request, response) => {
  request.url = '/graphiql';
  request.path = '/graphiql';
  request.method = 'GET';
  app(request, response);
};
