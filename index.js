const waitOn = require('wait-on');
const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const { introspectSchema } = require('@graphql-tools/wrap');
const { stitchSchemas } = require('@graphql-tools/stitch');
const { delegateToSchema } = require('@graphql-tools/delegate');

const makeRemoteExecutor = require('./lib/make_remote_executor');

async function makeGatewaySchema() {
  // build executor and subscriber functions
  // for communicating with remote services
  const postsExec = makeRemoteExecutor('http://localhost:14001/graphql');
  const postsSchema = await introspectSchema(postsExec);
  const postsSubSchema = { schema: postsSchema, executor: postsExec }
  return stitchSchemas({
    subschemas: [
      postsSubSchema
    ],
    resolvers: {
      Mutation: {
        createPost: (root, args, context, info) => {
          console.log("local code should run first");
          return delegateToSchema({
                   schema: postsSubSchema,
                   operation: "mutation",
                   fieldName: "createPost",
                   args: args,
                   context,
                   info,
                 });
        }
      }
    }
  });
}

const PORT = 14000

waitOn({ resources: ['tcp:14001'] }, async () => {
  const app = express();
  const schema = await makeGatewaySchema();
  const server = new ApolloServer({ schema }); // uses Apollo Server for its subscription UI features
  await server.start();
  server.applyMiddleware({ app });
  await new Promise(resolve => app.listen({ port: PORT}, resolve));
  console.log(`🚀 Server ready at http://localhost:${PORT}${server.graphqlPath}`);
});
