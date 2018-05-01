// Shims

const values = require('object.values');

if (!Object.values) {
  values.shim();
}

// Tool to combines a schema string with resolvers
const { makeExecutableSchema } = require('graphql-tools');

// Other tools for constructing a Relay compactiable schema
const { GraphQLScalarType } = require('graphql');
// const { connectionFromArray } = require('graphql-relay');
const {
  nodeInterface,
  nodeDefinitions,
  globalIdResolver,
  fromGlobalId,
  connectionDefinitions,
  pageInfoType,
} = require('graphql-relay-tools');

// Utils
const fs = require('fs');
const path = require('path');
const camelCase = require('camelcase');
const {
  getAllDataOfTypeFrom,
  langMap,
} = require('./utils');

// Load the GraphQL Schema
const typeDefs = fs.readFileSync(path.resolve(__dirname, '../schema.graphql'), 'utf8');

// Generate type definition for connections
const { connectionType: speakerConnectionType } = connectionDefinitions({
  name: 'Speaker',
});
const { connectionType: sessionConnectionType } = connectionDefinitions({
  name: 'Session',
});

// Load data
const dataStr = fs.readFileSync(path.resolve(__dirname, './data.json'), 'utf8');
const data = JSON.parse(dataStr);
const getAllDataOfType = getAllDataOfTypeFrom(data);

// Provide resolver function the node field
const { nodeResolver } = nodeDefinitions((globalId) => {
  const { type, id } = fromGlobalId(globalId);

  let dataType;
  switch (type) {
    case 'ScheduleItem':
      dataType = 'schedule';
      break;
    default:
      dataType = `${camelCase(type)}s`;
      break;
  }

  return Object.assign(getAllDataOfType(dataType).find(obj => obj.id === id), {
    __type: type,
  });
});

const resolveEventType = obj => (obj.speakerId ? 'Session' : 'Activity');

// Provide resolver functions for your schema fields
const resolvers = {
  Node: {
    __resolveType: obj => obj.__type, // eslint-disable-line no-underscore-dangle
  },
  URL: new GraphQLScalarType({
    name: 'URL',
    serialize(value) {
      return value;
    },
    parseValue(value) {
      return value;
    },
    parseLiteral(ast) {
      return ast.value;
    },
  }),
  DatetimeWithZone: new GraphQLScalarType({
    name: 'DatetimeWithZone',
    serialize(value) {
      return value;
    },
    parseValue(value) {
      return value;
    },
    parseLiteral(ast) {
      return ast.value;
    },
  }),
  Query: {
    node: nodeResolver,
    conference: (root, args) => data[args.code],
  },
  Conference: {
    id: globalIdResolver(),
    schedule: obj => obj,
  },
  ConferenceDate: {
    id: globalIdResolver(),
  },
  Event: {
    __resolveType: resolveEventType,
  },
  Session: {
    id: globalIdResolver(),
    speaker: obj => getAllDataOfType('speakers').find(o => o.id === obj.speakerId),
    language: obj => langMap[obj.language],
    tags: obj => obj.tagIds.map(id => getAllDataOfType('sessionTags').find(o => o.id === id)),
  },
  Activity: {
    id: globalIdResolver(),
  },
  Speaker: {
    id: globalIdResolver(),
  },
  Schedule: {
    items: (obj, args) => {
      if (args.date && args.date.id) {
        const { id } = fromGlobalId(args.date.id);
        const periods = obj.periods.filter(o => o.dateId === id);
        const periodIds = periods.map(o => o.id);
        const filterSchedule =
          s => s.periodIds.filter(periodId => periodIds.includes(periodId)).length > 0;
        return obj.schedule.filter(filterSchedule);
      }
      return obj.schedule;
    },
    periods: (obj, args) => {
      if (args.date && args.date.id) {
        const { id } = fromGlobalId(args.date.id);
        return obj.periods.filter(o => o.dateId === id);
      }
      return obj.periods;
    },
  },
  ScheduleItem: {
    id: globalIdResolver(),
    date: (obj) => {
      const periods = getAllDataOfType('periods').filter(o => obj.periodIds.includes(o.id));
      return getAllDataOfType('dates').find(o => o.id === periods[0].dateId);
    },
    periods: obj => getAllDataOfType('periods').filter(o => obj.periodIds.includes(o.id)),
    places: obj => getAllDataOfType('places').filter(o => obj.placeIds.includes(o.id)),
    event: (obj) => {
      if (obj.eventActivityId) {
        return getAllDataOfType('activities').find(o => o.id === obj.eventSessionId);
      } else if (obj.eventSessionId) {
        return getAllDataOfType('sessions').find(o => o.id === obj.eventSessionId);
      }
      return obj.event;
    },
    eventInterface: (obj) => {
      if (obj.eventActivityId) {
        const activity = getAllDataOfType('activities').find(o => o.id === obj.eventSessionId);
        return { activity };
      } else if (obj.eventSessionId) {
        const session = getAllDataOfType('sessions').find(o => o.id === obj.eventSessionId);
        return { session };
      }

      const { event } = obj;

      return {
        [camelCase(resolveEventType(event))]: event,
      };
    },
  },
  Period: {
    id: globalIdResolver(),
    date: obj => getAllDataOfType('dates').find(o => o.id === obj.dateId),
  },
  Place: {
    id: globalIdResolver(),
  },
};

// Export the GraphQL schema object as "schema"
exports.schema = makeExecutableSchema({
  typeDefs: [
    typeDefs,
    nodeInterface,
    pageInfoType,
    speakerConnectionType,
    sessionConnectionType,
  ],
  resolvers,
});
