# Specs

Specifications of XConf.

## GraphQL Schema

We have a [GraphQL Schema](./schema.graphql) written in the GraphQL Schema Language, and a [mock server](./mock-server) implemented with the help of `graphql-tools` that also acts as a specification, which can be started by `yarn run`.

With this schema defination and mock server, we're able to discuss and demonstrate ideas with more liberty. One can just modify it and send a PR, or even implement desired features on the client alone with the mock server, without waiting for the actual implementation.

The mock server is deployable via the [Serverless Framework](https://github.com/serverless/serverless) with the `yarn run deploy` command. (Previously we use [Apollo Launchpad](https://launchpad.graphql.com) but has faced restraineds as the data for our mock server grows.)
