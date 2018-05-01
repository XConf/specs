const express = require('express');
const { graphqlExpress, graphiqlExpress } = require('apollo-server-express');
const bodyParser = require('body-parser');
const mockServer = require('./mock-server/index');

const app = express();

app.use('/graphql', bodyParser.json(), graphqlExpress({ schema: mockServer.schema }));
app.get('/graphiql', graphiqlExpress({ endpointURL: '/graphql' }));

app.listen(1337, () => {
  console.log('Dev server listening on port 1337.');
});
