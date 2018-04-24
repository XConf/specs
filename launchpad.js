// Ruby × Elixir Conf - GraphQL Schema Design
// TODO: Add conf information like location, time, news, parties, CoC, sponsor...

// graphql-tools combines a schema string with resolvers.
import { makeExecutableSchema } from 'graphql-tools';
import { GraphQLScalarType } from 'graphql';

// Tools for constructing a Relay compactiable schema
import { connectionFromArray } from "graphql-relay";
import {
  nodeInterface,
  nodeDefinitions,
  nodeField,
  globalIdResolver,
  fromGlobalId,
  connectionDefinitions,
  connectionArgs,
  pageInfoType
} from "graphql-relay-tools";

// Utils
import 'babel-polyfill';
import flatten from 'array.prototype.flatten';
import camelCase from 'camelcase';
flatten.shim();

// Construct a schema, using GraphQL schema language
const typeDefs = `
  scalar DatetimeWithZone
  scalar URL

  enum Language {
    EN
    ZH_TW
  }

  type Query {
    ${nodeField}
    conference(code: String!): Conference
    scheduleItem(id: ID!): ScheduleItem
    speakers${connectionArgs()}: SpeakerConnection
    sessions${connectionArgs()}: SessionConnection
  }

  type Conference implements Node {
    id: ID!
    code: String!
    name: String!
    keyVisionUrl: URL!
    dates: [ConferenceDate!]!
    location: ConferenceLocation!
    wifiNetwork: ConferenceWifiNetwork!
    speakers: [Speaker!]!
    sessions: [Session!]!
    schedule: Schedule!
  }

  type ConferenceDate implements Node {
    id: ID!
    name: String!
    date: String!
  }

  type ConferenceLocation {
    name: String!
    address: String!
  }

  type ConferenceWifiNetwork {
    ssid: String!
    password: String!
  }

  interface Event {
    id: ID!
    title: String!
  }

  type EventInterface {
    session: Session
    activity: Activity
  }

  type Session implements Node, Event {
    id: ID!
    title: String!
    description: String!
    speaker: Speaker!
    speakerId: ID!
    language: Language!
    tags: [SessionTag!]!
    tagIds: [ID!]!
    slideUrl: String
    videoUrl: String
  }

  type SessionTag implements Node {
    id: ID!
    name: String!
  }

  type Activity implements Node, Event {
    id: ID!
    title: String!
  }

  type Speaker implements Node {
    id: ID!
    name: String!
    title: String
    pictureUrl: URL!
    bio: String
    homepageUrl: URL
    twitterUsername: String
    githubUsername: String
  }

  input ConferenceDateInput {
    id: ID
  }

  type Schedule {
    dates: [ConferenceDate!]!
    periods(date: ConferenceDateInput): [Period!]!
    places: [Place!]!
    items(date: ConferenceDateInput): [ScheduleItem!]!
  }

  type ScheduleItem implements Node {
    id: ID!
    date: ConferenceDate!
    places: [Place!]!
    placeIds: [ID!]!
    periods: [Period!]!
    periodIds: [ID!]!
    event: Event!
    eventInterface: EventInterface!
  }

  type Place implements Node {
    id: ID!
    name: String!
    mapImageUrl: URL
  }

  type Period implements Node {
    id: ID!
    date: ConferenceDate!
    start: DatetimeWithZone!
    end: DatetimeWithZone!
  }
`;

const { connectionType: speakerConnectionType } = connectionDefinitions({
  name: "Speaker"
});

const { connectionType: sessionConnectionType } = connectionDefinitions({
  name: "Session"
});

// Provide resolver function the node field
const { nodeResolver } = nodeDefinitions(globalId => {
  const { type, id } = fromGlobalId(globalId);

  let dataCollection = `${camelCase(type)}s`
  if (type === 'ScheduleItem') dataCollection = 'schedule'

  return {
    ...getData(confData)(dataCollection).find(obj => obj.id === id),
    __type: type
  };
});

// Provide resolver functions for your schema fields
const resolvers = {
  Node: {
    __resolveType: obj => obj.__type
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
    }
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
    }
  }),
  Query: {
    node: nodeResolver,
    conference: (root, args) => confData[args.code],
    scheduleItem: (root, args) => {
      const { id } = fromGlobalId(args.id);
      return getData(confData)('schedule').find(o => o.id === id);
    }
    // schedule: (root, args) => data.schedule[args.year],
    // speakers: (root, args) => connectionFromArray(data.speakers, args),
    // sessions: (root, args) => connectionFromArray(data.sessions, args)
  },
  Conference: {
    id: globalIdResolver(),
    schedule: (obj) => obj
  },
  ConferenceDate: {
    id: globalIdResolver()
  },
  Event: {
    __resolveType: obj => (obj.speakerId ? 'Session' : 'Activity')
  },
  Session: {
    id: globalIdResolver(),
    speaker: (obj) => getData(confData)('speakers').find(o => o.id === obj.speakerId),
    language: obj => langMap[obj.language],
    tags: obj => obj.tagIds.map(id => getData(confData)('sessionTags').find(o => o.id === id)),
  },
  Activity: {
    id: globalIdResolver()
  },
  Speaker: {
    id: globalIdResolver()
  },
  Schedule: {
    items: (obj, args) => {
      if (args.date && args.date.id) {
        const { id } = fromGlobalId(args.date.id);
        const periods = obj.periods.filter(o => o.dateId === id);
        const periodIds = periods.map(o => o.id);
        return obj.schedule.filter(s => s.periodIds.filter(periodId => periodIds.includes(periodId)).length > 0);
      }
      return obj.schedule
    },
    periods: (obj, args) => {
      if (args.date && args.date.id) {
        const { id } = fromGlobalId(args.date.id);
        return obj.periods.filter(o => o.dateId === id)
      }
      return obj.periods
    },
  },
  ScheduleItem: {
    id: globalIdResolver(),
    date: (obj) => {
      const periods = getData(confData)('periods').filter(o => obj.periodIds.includes(o.id))
      return getData(confData)('dates').find(o => o.id === periods[0].dateId)
    },
    periods: obj => getData(confData)('periods').filter(o => obj.periodIds.includes(o.id)),
    places: obj => getData(confData)('places').filter(o => obj.placeIds.includes(o.id)),
    event: (obj) => {
      if (obj.event) {
        return obj.event
      } else if (obj.eventSessionId) {
        return getData(confData)('sessions').find(o => o.id === obj.eventSessionId)
      }
    },
    eventInterface: (obj) => {
      if (obj.event) {
        return { activity: obj.event }
      } else if (obj.eventSessionId) {
        const session = getData(confData)('sessions').find(o => o.id === obj.eventSessionId)
        return { session }
      }
    }
  },
  Period: {
    id: globalIdResolver(),
    date: (obj) => getData(confData)('dates').find(o => o.id === obj.dateId)
  },
  Place: {
    id: globalIdResolver()
  },
};

// Export the GraphQL.js schema object as "schema"
export const schema = makeExecutableSchema({
  typeDefs: [
    typeDefs,
    nodeInterface,
    pageInfoType,
    speakerConnectionType,
    sessionConnectionType
  ],
  resolvers,
});

// Optional: Export a function to get context from the request. It accepts two
// parameters - headers (lowercased http headers) and secrets (secrets defined
// in secrets section). It must return an object (or a promise resolving to it).
export function context(headers, secrets) {
  return {
    headers,
    secrets,
  };
};

// Optional: Export a root value to be passed during execution
// export const rootValue = {};

// Optional: Export a root function, that returns root to be passed
// during execution, accepting headers and secrets. It can return a
// promise. rootFunction takes precedence over rootValue.
// export function rootFunction(headers, secrets) {
//   return {
//     headers,
//     secrets,
//   };
// };

// Mock data
// This is minified w/ JS Minify (https://dotmaui.com/jsminify/) cause of
// line number limitations of Apollo Launchpad, you can format this w/
// Prettier (https://prettier.io/playground) before editing.
const confData={2016:{code:"2016",name:"RubyConf 2016",keyVisionUrl:"https://i.imgur.com/a6x3nsK.png",dates:[{id:"d-1",date:"2016-12-02",name:"Day 1"},{id:"d-2",date:"2016-12-03",name:"Day 2"}],location:{name:"Activity Center of Academia Sinica Taiwan",address:"128, Sec. 2, Academia Rd., Nangang Dist., Taipei City 115, Taiwan"},wifiNetwork:{ssid:"5xRuby",password:"28825252"},speakers:[{id:"b57d6ba1",name:"Yukihiro (Matz) Matsumoto",title:"Creator of Ruby, Heroku",pictureUrl:"https://2016.rubyconf.tw/images/speakers/matz.png",bio:"Father of Ruby Programming Language",homepageUrl:"http://www.rubyist.net/~matz/",twitterUsername:"yukihiro_matz",githubUsername:"matz"},{id:"56e28e36",name:"Konstantin Hasse",title:"Co-Founder and CTO, Travis CI",pictureUrl:"https://2016.rubyconf.tw/images/speakers/rkh.jpg",bio:"Co-Founder and CTO at Travis CI, former opera star",homepageUrl:"http://rkh.im/",twitterUsername:"konstantinhaase",githubUsername:"rkh"},{id:"52ae5825",name:"Luba Tang",title:"CEO & founder, Skymizer",pictureUrl:"https://2016.rubyconf.tw/images/speakers/luba.jpg",bio:"CEO & founder of Skymizer",githubUsername:"lubatang"},{id:"4a7a71f8",name:"Brad Urani",title:"Principal Software Engineering, Procore",pictureUrl:"https://2016.rubyconf.tw/images/speakers/bradurani.jpg",bio:"Brad Urani loves talking, tweeting and blogging about software almost as much as he loves creating it. He's a veteran of 5 startups and a frequent conference and meetup speaker. He lives in Santa Barbara, California where he preaches the wonders of Ruby and relational databases as principal engineer at Procore.",githubUsername:"bradurani"},{id:"3eba3b64",name:"Chien-Wei Chu",title:"CTO, 財報狗",pictureUrl:"https://2016.rubyconf.tw/images/speakers/icarus4.jpg",bio:"離開最接近硬體的C語言，轉向投入最接近人腦思考的Ruby developer。\n現為財報狗CTO，主導財報狗數個重要技術專案，包含將網站由PHP無痛轉移至Rails、多個重要功能的效能大幅優化、打造高效率又可靠的爬蟲系統...等。",githubUsername:"icarus4"},{id:"e0b0cf60",name:"David Chang",title:"Software engineer, Solda",pictureUrl:"https://2016.rubyconf.tw/images/speakers/zetachang.jpg",bio:'Software engineer at <a href="https://solda.io">Solda</a> and creator of <a href="http://ruby-hyperloop.io/gems/reactrb/">Reactrb</a>. Started a journey learning and loving Ruby 5 years ago. Built tons of native mobile app and still thought crafting great font-end products is challenging and fun.',githubUsername:"zetachang"},{id:"f94958ad",name:"Don Werve",title:"Consultant, Minimum Viable",pictureUrl:"https://2016.rubyconf.tw/images/speakers/matadon.jpg",bio:"Although originally designed by Apple in California as a durability-testing device for laptops, Don has spent the past seven years working around the world as a software engineer and back-pocket CTO, helping companies solve tough team management and scaling issues.\nDon lives in Tokyo, and spends his spare time experimenting with advanced forms of deliciousness in his kitchen, hiking through the incredible beauty of the Japanese countryside, and training to survive the impending zombie apocalypse.",twitterUsername:"matadon",githubUsername:"matadon"},{id:"bdf17b92",name:"Eric Hodel",title:"Fastly",pictureUrl:"https://2016.rubyconf.tw/images/speakers/drbrain.jpg",bio:"Eric Hodel is a ruby committer and maintainer of many gems. He works at Fastly on the API features team maintaining and building ruby services that customers use to configure their CDN services.",githubUsername:"drbrain"},{id:"4decd308",name:"Florian Dutey",title:"Senior Backend Engineer, Strikingly",pictureUrl:"https://2016.rubyconf.tw/images/speakers/strikyflo.jpg",bio:"Hi, Im florian, I'm a web backend engineer for 9 years, using ruby since 2007. I'm from France, living in shanghai since 2013. I'm working with strikingly as ruby expert in backend team (also giving my 2 cents on front end from time to time). I'm mainly focused on data and code design (ie: not implementation) and DX (developper experience).",githubUsername:"strikyflo"},{id:"0f4bdfab",name:"Harisankar P S",title:"CEO/Chief Solutions Architect, Red Panthers Software Solutions (P) Ltd.",pictureUrl:"https://2016.rubyconf.tw/images/speakers/coderhs.jpg",bio:'Harisankar P S has been building SaaS application and API\'s using Ruby and Rails for the past 5 years. He is also the founder of Red Panthers, a Ruby on Rails dev shop based out in Kochi, India. He is interested in open source and organizes Open Source Saturdays and Ruby Meetup in Kochi. He also contributes to open source as well.\n<a href="http://github.com/coderhs">Github</a>\n<a href="http://twitter.com/coderhs">Twitter</a>',twitterUsername:"coderhs",githubUsername:"coderhs"},{id:"828f61da",name:"Hiro Asari",title:"Developer, Travis CI GmbH",pictureUrl:"https://2016.rubyconf.tw/images/speakers/BanzaiMan.jpg",bio:"Hiro Asari is a developer at Travis CI GmbH and core member of the JRuby team.\nHe is not very good at writing his own bio.",githubUsername:"BanzaiMan"},{id:"dba96035",name:"Ivan Nemytchenko",title:"Developer Advocate, Gitlab",pictureUrl:"https://2016.rubyconf.tw/images/speakers/inem.jpg",bio:"14 years in IT. Rubyist since 2008. Being co-founder of two outsourcing companies. Co-organised two IT conferences. Organised online internship for junior ruby developers. In 2015 moved to Serbia, and later joined GitLab as Developer Advocate",githubUsername:"inem"},{id:"3a58a69c",name:"Juin Chiu",title:"Web developer, iCook, Polydice Inc.",pictureUrl:"https://2016.rubyconf.tw/images/speakers/davidjuin0519.jpg",bio:"I am currently a Rubyist, interested in functional programming, data engineering, and machine learning. Also a biker and a foodie on the side",twitterUsername:"JuinChiu",githubUsername:"davidjuin0519"},{id:"7ad45133",name:"Julian Cheal",title:"Senior Software Developer, Red Hat",pictureUrl:"https://2016.rubyconf.tw/images/speakers/juliancheal.jpg",bio:"A British Ruby/Rails developer, with a penchant for tweed, fine coffee, and homebrewing. When not working for clients, I help organise fun events around the world that teach people to program flying robots. I also occasionally speak at international conferences on the intersection of programming and robotics.",githubUsername:"juliancheal"},{id:"d4890756",name:"Kazuyuki Honda",title:"DevOps Engineer, Quipper Ltd",pictureUrl:"https://2016.rubyconf.tw/images/speakers/hakobera.jpg",bio:"Kazuyuki loves Ruby and a cup of coffee. After working 9 years at IBM, M3 as a Java/Node.js web application developer, he joined EdTech company Quipper as a DevOps engineer. And now working on to make something automatic.",twitterUsername:"hakobera",githubUsername:"hakobera"},{id:"b8926f75",name:"Kei Sawada",title:"Software Engineer, Recruit Holdings Co., Ltd. ",pictureUrl:"https://2016.rubyconf.tw/images/speakers/remore.jpg",bio:"Kei started his career in 2001 as a Tokyo-based software engineer and finally met Ruby in 2011. Ruby and its community quickly caught his attention and interest him very much, and since then he always picks up Ruby in the first place whenever he needs to make software. His most well-known project is Burn created in 2014, which is a toolkit to create 8-bit flavored application. He also plays the contrabass every weekend.",twitterUsername:"remore",githubUsername:"remore"},{id:"896381ed",name:"Kiyoshi Nomo",title:"Software engineer",pictureUrl:"https://2016.rubyconf.tw/images/speakers/kysnm.jpg",bio:'Software engineer, Living in Tokyo\n<a href="https://twitter.com/kysnm">https://twitter.com/kysnm</a>',twitterUsername:"kysnm",githubUsername:"kysnm"},{id:"e2e7b4a0",name:"Layne McNish",title:"Software Engineer, Omada Health",pictureUrl:"https://2016.rubyconf.tw/images/speakers/laynemcnish.jpg",bio:"Software Engineer at Omada Health in San Francisco, CA",twitterUsername:"lmcnish14",githubUsername:"laynemcnish"},{id:"909ff02a",name:"Satoshi Tagomori",title:"Software Engineer, Treasure Data, Inc.",pictureUrl:"https://2016.rubyconf.tw/images/speakers/tagomoris.jpg",bio:"OSS developer/maintainer: Fluentd, Norikra, MessagePack-Ruby, Woothee and many others mainly about Web services, data collecting and distributed/streaming data processing.\nLiving in Tokyo, and working for Treasure Data.",twitterUsername:"tagomoris",githubUsername:"tagomoris"},{id:"328ed5c5",name:"Sebastian Sogamoso",title:"Cookpad",pictureUrl:"https://2016.rubyconf.tw/images/speakers/sebasoga.jpg",bio:"Sebastián is a software developer that loves pair programming and has a passion for teaching. He works as a software engineer at Cookpad helping make everyday cooking fun. In his free time he is involved on the local software development groups and organize RubyConf Colombia.\nHe enjoys a good cup of Colombian coffee each morning which is his secret weapon to start the day in a great code-writing mood.",twitterUsername:"sebasoga",githubUsername:"sebasoga"},{id:"5b5c262e",name:"Shi-Gang Wang",title:"Software engineer, Goldenio Technoloy",pictureUrl:"https://2016.rubyconf.tw/images/speakers/bih00425.jpg",bio:"熟悉 ruby 和一點點的 bioinformation，試著把兩者結合，希望創造出有趣的東西。\n任職於黃碼科技 Goldenio Techology。",githubUsername:"bih00425"},{id:"8ff9661c",name:"Shi-Ken Don",title:"Web Developer, 貝殼放大",pictureUrl:"https://2016.rubyconf.tw/images/speakers/shikendon.jpg",bio:"土生土長的澎湖人，國中時因緣際會接觸到 VB6 從此對程式設計深深著迷，高中時踏入 Web Design & Web Security 的領域，但真正開始寫出東西是在大學一年級的暑假使用 PHP 寫出自己的網站，中間也陸續碰過 C++, Java, Python 等各種語言，目前最喜歡的語言是 Ruby，可以說到了沒有 Ruby 就不想寫程式的地步，現為貝殼放大的 Web Developer。",githubUsername:"shikendon"},{id:"d1f3695a",name:"TAI-AN SU",pictureUrl:"https://2016.rubyconf.tw/images/speakers/taiansu.jpg",bio:"三年電腦雜誌編輯，七年網頁應用程式開發。\n母語是 Ruby，兼熟 JavaScript 及 Elixir。\n滿分考的 JAVA 忘光了，總是在探索程式語言的本質。\nElixir.tw, RailsGirls 共同主辦人，RubyConf 講者。\n喜歡貓，探戈，小說及下雨天。",githubUsername:"taiansu"},{id:"69525684",name:"Shyouhei Urabe",title:"ruby-core committer, Money Forward, Inc.",pictureUrl:"https://2016.rubyconf.tw/images/speakers/shyouhei.jpg",bio:"Shyouhei is a long time ruby-core contributor. He was the branch mentor of 1.8.x in 1.8 era. He also introduced the ruby/ruby github repo back then. Today he is a full-timer to develop ruby interpreter at a fintech startup called Money Forward, inc. based in Japan.",twitterUsername:"https://speakerdeck.com/shyouhei/optimizing-ruby",githubUsername:"shyouhei"},{id:"17ffc64a",name:"Yasuko Ohba",title:"President, Everyleaf Corporation",pictureUrl:"https://2016.rubyconf.tw/images/speakers/nay.jpg",bio:"A Ruby / Rails programmer in Tokyo, Japan. President of Everyleaf Corporation, which provides software development service mostly with Rails for clients since 2007. I have written 2 books on Ruby in Japan. A mother of a 3 year old girl.",githubUsername:"nay"},{id:"c17f6938",name:"Yatish Mehta",title:"Engineer, Coupa Software",pictureUrl:"https://2016.rubyconf.tw/images/speakers/yatish27.jpg",bio:"Yatish Mehta, is a Software Engineer at Coupa Software. An NC State Graduate, he has also been a part of really interesting startups like Fab.com and Sungard. Yatish doesn’t shy away from talking about his first love, Ruby. While Ruby still remains his core competency, recently he’s begun exploring the mighty Golang as well. If you don’t find him experimenting with software, you’re sure to find him playing around in the kitchen. He lives by the motto, ‘I don’t have dreams, I have goals’... you guessed it right, he is a big Suits fan too. ",githubUsername:"yatish27"},{id:"ef9794b1",name:"Yoh Osaki",title:"Software engineer, Ubiregi inc.",pictureUrl:"https://2016.rubyconf.tw/images/speakers/youchan.jpg",bio:"Yoh Osaki\nSoftware engineer at Ubiregi inc.\nAuthor of Hyalite which is react-like virtual DOM library.\nMember of Asakusa.rb, Chidoriashi.rb",twitterUsername:"youchan",githubUsername:"youchan"},{id:"678da819",name:"Zong-Yu Wu",title:"Software Engineer, Trend Micro",pictureUrl:"https://2016.rubyconf.tw/images/speakers/zongyuwu.jpg",bio:"熱愛Ruby、資訊安全，目前在趨勢科技擔任工程師。",githubUsername:"zongyuwu"}],sessions:[{id:"d2ba3fbf",title:"Beware of Alpha Syndrome",description:"Matz talks about psychological phenomenon of programmers",speakerId:"b57d6ba1",language:"en",tagIds:["t-r"],videoUrl:"https://youtu.be/a8ycBvTzl3Y"},{id:"62e21cbb",title:"How we replaced salary negotiations with a Sinatra app",description:"Let's talk about salaries, diversity, career development, getting compensated in gold and silver, paying taxes in livestock and Ruby code. We at Travis CI have been working on a new salary system to determine how much we pay whom, when employees get raises and a whole range of other things. After lots of back and forth, we ended up with a Sinatra application to solve salary questions. Expect to explore the topic from many different angles and levels. We'll look at decisions, realisations and implications, as well as interesting parts of the implementation.",speakerId:"56e28e36",language:"en",tagIds:["t-r"],videoUrl:"https://youtu.be/F6PaAloyp20"},{id:"2786b17f",title:"Ruby, facing the change of world-wide server-class microprocessors",description:"隨著物聯網與雲端服務的盛行，傳統的 server class microprocessor 逐漸地從 general propose 轉變成為 workload specific；雲端服務採購 workload specific processor 的比重從 2010 年 9% 提升到今年至少 30%，比重逐年增加。為了因應 workload specific processor，許多程式語言都逐漸從 interpreter base、JIT base 轉向到 compiler base。Ruby language 的架構是採用純 interpreter base，致使 Skymizer 在針對客戶 workload 優化時，遭遇許多困難。本篇 talk 會指出 Ruby langauge 現行 VM 上設計的問題，說明為何其無法針對客戶 workload 進行客製化，以期之後社群的努力與改進。",speakerId:"52ae5825",language:"zh-TW",tagIds:["t-r"],videoUrl:"https://youtu.be/AWVnCI-d4RQ"},{id:"0e289e8a",title:"Buidling HUGE web apps: Rails at 1,000,000 Lines of Code",description:"There's big, and there's HUGE. Conventional wisdom says that huge teams with huge apps are slow and unresponsive. However, with great people, the right culture and diligent engineering, a team of 60 can perform like a team of 6.\nJoin us for a story of HUGE. Learn which tools, patterns and practices help you manage growth, and which don't. Hear how trust in your teammates trumps consistency of design, and how scale changes priorities.\nBuilding a huge app takes focus and leadership, but if you prioritize people over process, you can stay fast, agile and bug free even when you're huge.",speakerId:"4a7a71f8",language:"en",tagIds:["t-r"],slideUrl:"https://docs.google.com/presentation/d/1kqgbAEIDeyG5qRL7h6s3ERdpls05lxxomaQKxSKFGNY/edit?usp=sharing",videoUrl:"https://youtu.be/0EpgXNbC6x4"},{id:"65afbad7",title:"利用 Sidekiq Enterprise 打造高效率與高可靠度的爬蟲系統",description:"在財報狗 (statementdog.com)，我們提供友善的介面與大量的財務數據輔助股票投資人進行投資決策。這些數據的背後是由大量的爬蟲與運算邏輯程式碼所建構而成。在我們的資料庫中，每一檔股票各自都有近千項數據要抓取與計算，在總計數千檔股票都有近千項數據要處理的情況下，如何做到穩定又快速的更新數據與資訊，是一項不容易的任務。在這次的 talk 中，我們將會分享我們在建構系統時所面臨的挑戰、以及我們如何利用 Sidekiq Enterprise 打造出一個高效率又可靠的爬蟲系統。(本 talk 不探討如何撰寫 crawler 的相關議題，例如 Nokogiri 或 Mechanise 等相關 gem 的使用方式)",speakerId:"3eba3b64",language:"zh-TW",tagIds:["t-r"],slideUrl:"http://www.slideshare.net/GaryChu1/building-efficient-and-reliable-crawler-system-with-sidekiq-enterprise",videoUrl:"https://youtu.be/iNyfyD_33vQ"},{id:"cbd45b89",title:"A React Inspired UI framework in Pure Ruby",description:"A framework presented will demonstrate how to build user interface in pure ruby by using declarative and component-based approach.",speakerId:"e0b0cf60",language:"zh-TW",tagIds:["t-r"],slideUrl:"https://speakerdeck.com/zetachang/a-react-inspired-ui-framework-in-pure-ruby",videoUrl:"https://youtu.be/jHC7oxoZL_E"},{id:"373f368d",title:"To Code Is Human",description:"Mastering the art of programming requires both the ability to rapidly understand specific problem domains, as well as comprehensive working knowledge of software development tools, from individual libraries, to programming languages, to the fundamental limits of computing hardware itself.\nBut what is often neglected is an understanding of the most heavily-used and relied-upon tool in the software developer's toolbox: the programmer's brain itself.\nIn this talk, we will combine the art of programming with the science of cognitive psychology, and emerge with a set of simple, proven techniques that we can use to craft software that is drastically less buggy, easier to understand, and more adaptive in the face of change.",speakerId:"f94958ad",language:"en",tagIds:["t-e"],slideUrl:"http://www.slideshare.net/DonWerve1/to-code-is-human"},{id:"2a1aab7a",title:"Building maintainable command-line tools with MRuby",description:"MRuby and mruby-cli makes it possible to ship single binary command-line tools that can be used without setup effort. How can we make these easy to write too?\nExisting libraries for making command-line tools are built for experienced rubyists. This makes them a poor choice for porting to MRuby.\nIn this talk we'll explore how to build a command-line tool with mruby-cli along with a design and philosophy that makes it easy to create new commands and maintain existing commands even for unfamiliar developers.",speakerId:"bdf17b92",language:"en",tagIds:["t-r"],videoUrl:"https://youtu.be/8GP3mCxB5JA"},{id:"0972d8ad",title:"Large scale Rails applications",description:"Rails patterns are amazing for prototyping, but they are actually very bad practices for large scale production applications.\nAlso, Rails comes with lot of handy tools to break many barriers for web beginners while introducing tons of good practices. Again, those good practices are a good introduction, but they don't fit large scale production applications, especially when it comes to modern practices in front end world.\nI will discuss why those patterns are not a fit, and how they can be replaced (completely dropped for another technology, or how to improve them). Delivering good practices that should be implemented as soon as your project is no more a prototype to scale your tests speed, your maintainability.",speakerId:"4decd308",language:"en",tagIds:["t-r"],slideUrl:"http://www.slideshare.net/testdeouf/rubyconf-taiwan-2016-large-scale-rails-applications",videoUrl:"https://youtu.be/vokjrQwTIQM"},{id:"029d3e17",title:"Using database to pull your applications weight",description:"Most Ruby on Rails application out there in the world deals with the manipulation and presentation of data. So the speed of our application has a relationship with how fast we work with data. Ruby on Rails, the swiss army knife of web development, is good with presenting data. But when it comes to crunching huge volumes of data, our rails application starts to slow down. Here we are not talking about joining a couple of rows from multiple tables, but about processing months of historical data and providing meaning full information.\nDatabases are good at processing data, but we sometimes make the mistake of just using it to as a file cabinet. The database is optimized to crunch GB's of data and return to us the results that we need.\nSo my talk would be about how to optimize your database so as to speed up your existing Ruby on Rails application.",speakerId:"0f4bdfab",language:"en",tagIds:["t-r"],slideUrl:"https://speakerdeck.com/coderhs/using-databases-to-pull-your-application-weight",videoUrl:"https://youtu.be/zJnFepGZWME"},{id:"ffc19803",title:"Ruby, HTTP/2 and You",description:"HTTP/2 is here.\nThe first major revision since 1997 to Hypertext Transfer Protocol on which so much of the modern information transfer relies, HTTP/2 could have an enormous impact on the way we write applications.\nAlong with the history of HTTP and the current support status in the Ruby and Rails ecosystems, we will discuss how your web app can take advantage of HTTP/2.",speakerId:"828f61da",language:"en",tagIds:["t-r"],videoUrl:"https://youtu.be/Imol0joczlo"},{id:"f6133b0a",title:"Breaking Bad Habits with GitLab CI",description:"GitLab is known in Ruby community for years. 2 years ago GitLab has made a huge leap forward by integrating CI system.\nIn this talk we’ll explore its functionality. The talk consists of two stories, where companies started from manual process, and step by step automated their it. Here’s what you will learn:\n<ul>\n<li>how to execute a single command?</li>\n<li>how to run multiple commands in sequence?</li>\n<li>how to run them in parallel?</li>\n<li>how to pass artifacts between stages?</li>\n<li>how to deploy with GitLab CI?</li>\n<li>how to deploy to multiple environments?</li>\n</ul>\nYou’ll be amazed how simple, yet powerful it is.",speakerId:"dba96035",language:"en",tagIds:[],slideUrl:"http://www.slideshare.net/creatop/breaking-bad-habits-with-gitlab-ci-70010645",videoUrl:"https://youtu.be/WDmCteXwUtM"},{id:"8ae0be0c",title:"Exploring Functional Programming by Rebuilding Redux",description:'The goal of this talk is to introduce basic functional programming concepts. This will be achieved by demonstrating how to rebuild <a href="https://github.com/reactjs/redux">Redux</a>, a popular Javascript library, using Ruby. For this purpose, I open-sourced a gem called <a href="https://github.com/davidjuin0519/rubidux">Rubidux</a>, which borrows the model from Redux.',speakerId:"3a58a69c",language:"en",tagIds:["t-r"],slideUrl:"https://github.com/davidjuin0519/talks/blob/master/ruby_conf_taiwan/20161203_exploring_functional_programming_by_rebuilding_redux/slides.md",videoUrl:"https://youtu.be/QlWG9NTIol4"},{id:"15bd5259",title:"It's More Fun to Compute",description:"Come with us now on a journey through time and space. As we explore the world of analog/digital synthesis. From computer generated music to physical synthesisers and everything in between.\nSo you want to write music with code, but don’t know the difference between an LFO, ADSR, LMFAO, etc. Or a Sine wave, Saw wave, Google wave. We’ll explore what these mean, and how Ruby can be used to make awesome sounds. Ever wondered what Fizz Buzz sounds like, or which sounds better bubble sort or quick sort? So hey Ruby, let’s make music!",speakerId:"7ad45133",language:"en",tagIds:["t-e"],videoUrl:"https://youtu.be/7tgADhpzZE8"},{id:"0e598f10",title:"How to write complex data pipelines in Ruby",description:"We often write a code to build data pipelines, which include multiple ETL process,\nsummarize large size data, generate reports and so on. But it's not easy to write robust data pipelines in Ruby. Because there are many things to consider not only write a business logic but idempotence, dependency resolution, parallel execution, error handling and retry.\nI'm working on it over 2 years, so I want to share how to write complex data pipelines in Ruby using <a href=\"http://tumugi.github.io/\">tumugi</a>, which is a gem I made.",speakerId:"d4890756",language:"en",tagIds:["t-r"],slideUrl:"https://speakerdeck.com/hakobera/how-to-write-complex-data-pipeline-in-ruby",videoUrl:"https://youtu.be/USkkZjqBR70"},{id:"c04fc016",title:"How I made a pure-Ruby word2vec program more than 3x faster",description:"Ruby made programmers happy. I was no exception until I started to port original word2vec.c to Ruby. What was disappointing to me was the fact that large-scale scientific computation with CRuby is too time-consuming as the number of loops gets bigger. This experience led me to create VirtualModule, which lets you reduce execution time by running your arbitrary Ruby code on the other language VM process. In this talk, you will find out about when CRuby doesn't perform very well and what kind of bottlenecks you can workaround using VirtualModule.",speakerId:"b8926f75",language:"en",tagIds:["t-r"],slideUrl:"https://speakerdeck.com/remore/how-i-made-a-pure-ruby-word2vec-program-more-than-3x-faster",videoUrl:"https://youtu.be/_faXu2sBzAM"},{id:"c95d4543",title:"What is the Rack Hijacking API",description:"<h2>Rack Hijacking API</h2>\n<ul>\n<li>What is the Rack Hijacking API</li>\n<li>How to use</li>\n<li>Details of implementation</li>\n</ul>",speakerId:"896381ed",language:"en",tagIds:["t-r"],slideUrl:"http://www.slideshare.net/TokyoIncidents/what-is-rack-hijacking-api-69807904",videoUrl:"https://youtu.be/lUahszszZr8"},{id:"91f5ee6c",title:"Solving your onboarding problems with Ruby",description:"Starting at a new company is hard. It's even harder when half the instructions and documentation to get you ready to code is out of date or missing key parts. We're Rubyists, not HR managers. Why don't we solve our issues through code instead of more Wikis and READMEs?",speakerId:"e2e7b4a0",language:"en",tagIds:["t-r"],slideUrl:"http://www.slideshare.net/LayneMcNish/onboarding-the-ruby-way",videoUrl:"https://youtu.be/QemOkwxmbYY"},{id:"4c941e73",title:"How to Write Middleware in Ruby",description:"This presentation will show how to write middleware in Ruby.\nMiddleware are required:\n* to work well on various environment/platform\n* not to crash for unexpected data or unstability of network\n* not to consume cpu/memory or other resources unexpectedly\n* and many things\nThe presenter, a main developer of Fluentd, will show you many things to be considered, and many troubles/accidents we met.",speakerId:"909ff02a",language:"en",tagIds:["t-r"],slideUrl:"http://www.slideshare.net/tagomoris/how-to-write-middleware-in-ruby",videoUrl:"https://youtu.be/402QbqtfVeY"},{id:"c2d766f9",title:"The overnight failure",description:"This talk is based on a true horror story.\nImagine your work week ends after releasing a set of features to production. Your team is happy and you feel good about yourself. A call about a problem with payments wakes you up the next morning. You find out your most valuable users were charged hundreds of times, consuming their credit card limits, leaving others in overdraft. They're angry because they can't even buy milk at the store.\nIn this talk you'll learn how a &quot;perfect bug storm&quot; caused the problem, how our processes failed to catch it and how hard it was to gain our users and teammates trust back.",speakerId:"328ed5c5",language:"en",tagIds:[],slideUrl:"https://speakerdeck.com/sebasoga/the-overnight-failure",videoUrl:"https://youtu.be/L9TkoFO1FhY"},{id:"874146e0",title:"Writing Data Analysis Pipeline As Ruby Gem",description:"在分析 DNA/RNA 資料上，已有許多工具可供使用，可透過不同工具的結合，可以找出可能導致疾病或癌症的變異點，但工具繁雜，每套工具所需要的參數及使用方法不同，控制每個步驟相當麻煩，必須精通各種分析工具的用法。\n希望透過這個 talk 讓聽眾暸解，要串接 C 和 JAVA 等語言撰寫的分析工具時，可以利用 RUBY 的套件，撰寫簡單的 code 來處理複雜的分析流程．我們將工具與參數的使用，撰寫成 RUBY 模組，並利用 templete 系統組合出一個 robust 的資料分析流程 (Cagnut)。\n執行分析流程通常會花費相當大的資源與時間，我們將以 Cagnut 為核心，探討如何撰寫輔助套件(cagnut-cluster)，讓 Cagnut 可以運用不同 cluster 上的排程系統，如 LSF、SGE、Torque (PBS)，達到節省分析巨量資料的時間。",speakerId:"5b5c262e",language:"zh-TW",tagIds:["t-r"],slideUrl:"http://www.slideshare.net/SeanSGWang/writing-data-analysis-pipeline-as-ruby-gem",videoUrl:"https://youtu.be/r1FLLLMDjYk"},{id:"cb00cabe",title:"從零開始的爬蟲之旅",description:"以過來人的經驗分享用 Ruby 每分鐘抓取 2000+ 頁面、維護上億筆紀錄資料庫的心路歷程，從單線程到多線程再到 Auto Scaling 讓大家一步一步體會撰寫爬蟲各階段可能遇到的瓶頸，期望能在未來為從事相關工作的朋友們帶來一點幫助。",speakerId:"8ff9661c",language:"zh-TW",tagIds:["t-r"],slideUrl:"http://www.slideshare.net/shikendon/crawler-from-zero",videoUrl:"https://youtu.be/-4eJzY5WMGI"},{id:"f6aab845",title:"Phoenix demythify, with fun",description:"Phoenix 是根基於 Elixir 語言的 Web MVC 框架。除了 Elixir 與 Ruby 語法上的相似之外，這框架也從 Rails 「致敬」了許多概念及元件。這個講題會比較 Rails 與 Phoenix 在概念上相似及相異的部份，並告訴你用 Phoenix 開發時，哪些觀念及手法可以繼續使用，而哪些部份需要新的觀念，以及為什麼要這樣設計。\n而對於正在使用 Rails 的開發者而言，也可以找一些 Rails 上的設計問題，及能適用於 Rails 的新手法及觀念。",speakerId:"d1f3695a",language:"zh-TW",tagIds:["t-e"],slideUrl:"http://www.slideshare.net/taiansu/phoenix-demysitify-with-fun",videoUrl:"https://youtu.be/8tDGHQddry4"},{id:"db0e0dfe",title:"Optimizing Ruby Core",description:"I made ruby interpreter 10 times faster. Let me show you how.",speakerId:"69525684",language:"en",tagIds:["t-r"],slideUrl:"https://speakerdeck.com/shyouhei/optimizing-ruby",videoUrl:"https://youtu.be/keJwE_eScyA"},{id:"f201be60",title:"Value And Pain to Keep Rails Applications Alive",description:"In 2014-2015 my team migrated a series of applications from Rails 2.3.5 to 4.2.1, and Ruby 1.8 to 2.1. Our goal was to add large features, while substantially refactoring the whole system. It was a big challenge!\nThis talk will cover the timeline of the project and talk about all the things a team performing a large migration of Ruby and Rails will need to do. Secondly, I'll talk about importance, hardness, and some techniques to keep Rails applications healthy and maintainable. ",speakerId:"17ffc64a",language:"en",tagIds:["t-r"],slideUrl:"https://speakerdeck.com/nay3/value-and-pain-to-keep-rails-applications-alive",videoUrl:"https://youtu.be/QIKBsdrTg84"},{id:"88c61ccf",title:"ActionCable and ReactJS tie the knot",description:"ActionCable is the new young prince of the Rails kingdom. He is young but powerful, en route to getting recognized for his skills? . ReactJS is the new princess of the JS kingdom. Recently, everyone has fallen head over heels in love with her. Together they are bound to create a powerful empire. Let’s watch the magic unveil as these two unite.",speakerId:"c17f6938",language:"en",tagIds:["t-r"],videoUrl:"https://youtu.be/dBPGCx2iMbg"},{id:"36274744",title:"Isomorphic web programming in Ruby",description:"For JavaScript, The method is available that is the isomorphic programming.\nThe isomorphic programming is the method exploiting the advantages obtained by same code running on both the server-side and client-side.\nFor examle, React is reducing the overhead of iniitial rendering in client side by server side rendering.\nOn the other hand, for the rubyists, We can also write ruby code on client side by using Opal.\nThis talk introduces a new framework for isomorphic programming with the Opal: Menilite.\nMenilite shares model code between the server side and the client side by marshalling objects and storing them in the database automatically.\nAs a result, code duplication is reduced and APIs are no longer a necessity.\nIsomorphic programming can significantly accelerate your progress on a project; I sincerely hope you find it helpful in developing web applications.\nMenilite aims to expand the playing field for the Ruby language, a language optimized for developer happiness. I'm sure you will agree that we will find even more happiness by bringing Ruby to the front-end as well.",speakerId:"ef9794b1",language:"en",tagIds:["t-r"],slideUrl:"http://slides.youchan.org/RubyConfTaiwan2016",videoUrl:"https://youtu.be/1Qvs1e0RyIY"},{id:"42cf44a4",title:"利用 Ruby 撰寫勒索軟體並探討如何安全的使用密碼系統",description:"資訊安全是用來保障你我資料安全與個人隱私的技術，而密碼學扮演其中重要的角色，講題內容會以如何使用 Ruby 撰寫簡單的勒索軟體 (Ransomeware) 來探討如何安全的使用密碼系統。",speakerId:"678da819",language:"zh-TW",tagIds:["t-r"],slideUrl:"https://speakerdeck.com/zongyuwu/ruby-ransomware-and-cryptosystem",videoUrl:"https://youtu.be/mqxuM_5YgxE"}],sessionTags:[{id:"t-r",name:"Ruby"},{id:"t-e",name:"Elixir"}],places:[{id:"pl-a",name:"Auditorium"},{id:"pl-1",name:"1st Conference Room"}],periods:[{id:"p-1",dateId:"d-1",start:"2016-12-02T09:00:00+0800",end:"2016-12-02T09:30:00+0800"},{id:"p-2",dateId:"d-1",start:"2016-12-02T09:30:00+0800",end:"2016-12-02T09:40:00+0800"},{id:"p-3",dateId:"d-1",start:"2016-12-02T09:40:00+0800",end:"2016-12-02T10:40:00+0800"},{id:"p-4",dateId:"d-1",start:"2016-12-02T10:50:00+0800",end:"2016-12-02T11:20:00+0800"},{id:"p-5",dateId:"d-1",start:"2016-12-02T11:30:00+0800",end:"2016-12-02T12:00:00+0800"},{id:"p-6",dateId:"d-1",start:"2016-12-02T12:00:00+0800",end:"2016-12-02T13:30:00+0800"},{id:"p-7",dateId:"d-1",start:"2016-12-02T13:30:00+0800",end:"2016-12-02T14:00:00+0800"},{id:"p-8",dateId:"d-1",start:"2016-12-02T14:10:00+0800",end:"2016-12-02T14:40:00+0800"},{id:"p-9",dateId:"d-1",start:"2016-12-02T14:40:00+0800",end:"2016-12-02T15:10:00+0800"},{id:"p-10",dateId:"d-1",start:"2016-12-02T15:20:00+0800",end:"2016-12-02T15:50:00+0800"},{id:"p-11",dateId:"d-1",start:"2016-12-02T16:05:00+0800",end:"2016-12-02T17:35:00+0800"},{id:"p-12",dateId:"d-1",start:"2016-12-02T18:05:00+0800",end:"2016-12-02T20:35:00+0800"},{id:"p-13",dateId:"d-2",start:"2016-12-03T09:00:00+0800",end:"2016-12-03T09:30:00+0800"},{id:"p-14",dateId:"d-2",start:"2016-12-03T09:30:00+0800",end:"2016-12-03T10:00:00+0800"},{id:"p-15",dateId:"d-2",start:"2016-12-03T10:10:00+0800",end:"2016-12-03T11:20:00+0800"},{id:"p-16",dateId:"d-2",start:"2016-12-03T11:30:00+0800",
end:"2016-12-03T12:00:00+0800"},{id:"p-17",dateId:"d-2",start:"2016-12-03T12:00:00+0800",end:"2016-12-03T13:30:00+0800"},{id:"p-18",dateId:"d-2",start:"2016-12-03T13:30:00+0800",end:"2016-12-03T14:00:00+0800"},{id:"p-19",dateId:"d-2",start:"2016-12-03T14:05:00+0800",end:"2016-12-03T14:35:00+0800"},{id:"p-20",dateId:"d-2",start:"2016-12-03T14:40:00+0800",end:"2016-12-03T15:10:00+0800"},{id:"p-21",dateId:"d-2",start:"2016-12-03T15:15:00+0800",end:"2016-12-03T15:45:00+0800"},{id:"p-22",dateId:"d-2",start:"2016-12-03T15:45:00+0800",end:"2016-12-03T16:15:00+0800"},{id:"p-23",dateId:"d-2",start:"2016-12-03T16:15:00+0800",end:"2016-12-03T16:45:00+0800"},{id:"p-24",dateId:"d-2",start:"2016-12-03T16:55:00+0800",end:"2016-12-03T17:55:00+0800"},{id:"p-25",dateId:"d-2",start:"2016-12-03T17:55:00+0800",end:"2016-12-03T18:05:00+0800"}],schedule:[{id:"c416ae39",periodIds:["p-1"],placeIds:["pl-a","pl-1"],event:{id:"c416ae39",title:"Registration"}},{id:"56e047e5",periodIds:["p-2"],placeIds:["pl-a","pl-1"],event:{id:"56e047e5",title:"Opening"}},{id:"78c1e1c5",periodIds:["p-3"],placeIds:["pl-a","pl-1"],eventSessionId:"d2ba3fbf"},{id:"49225f30",periodIds:["p-4"],placeIds:["pl-a"],eventSessionId:"f6133b0a"},{id:"f5f54987",periodIds:["p-4"],placeIds:["pl-1"],eventSessionId:"c2d766f9"},{id:"3ff54a05",periodIds:["p-5"],placeIds:["pl-a"],eventSessionId:"db0e0dfe"},{id:"3b40cd44",periodIds:["p-5"],placeIds:["pl-1"],eventSessionId:"f201be60"},{id:"a6f1cfa8",periodIds:["p-6"],placeIds:["pl-a","pl-1"],event:{id:"a6f1cfa8",title:"Lunch"}},{id:"2c999a38",periodIds:["p-7"],placeIds:["pl-a"],eventSessionId:"0e598f10"},{id:"3c9ee1dc",periodIds:["p-7"],placeIds:["pl-1"],eventSessionId:"029d3e17"},{id:"ca1afaa4",periodIds:["p-8"],placeIds:["pl-a"],eventSessionId:"15bd5259"},{id:"2208be91",periodIds:["p-9"],placeIds:["pl-a"],eventSessionId:"c04fc016"},{id:"90d4c7c2",periodIds:["p-8","p-9"],placeIds:["pl-1"],eventSessionId:"36274744"},{id:"2c568e9d",periodIds:["p-10"],placeIds:["pl-a"],eventSessionId:"4c941e73"},{id:"6eb5e3d6",periodIds:["p-10"],placeIds:["pl-1"],eventSessionId:"373f368d"},{id:"fc568f1b",periodIds:["p-11"],placeIds:["pl-a","pl-1"],event:{id:"fc568f1b",title:"Unconference"}},{id:"cfe9f751",periodIds:["p-12"],placeIds:["pl-a","pl-1"],event:{id:"cfe9f751",title:"Official Party"}},{id:"5d544fa4",periodIds:["p-13"],placeIds:["pl-a","pl-1"],event:{id:"5d544fa4",title:"Registration"}},{id:"d7f3fb5d",periodIds:["p-14"],placeIds:["pl-a"],eventSessionId:"42cf44a4"},{id:"c2dacc4d",periodIds:["p-14"],placeIds:["pl-1"],eventSessionId:"88c61ccf"},{id:"f32222f8",periodIds:["p-15"],placeIds:["pl-a","pl-1"],eventSessionId:"2786b17f"},{id:"61833ac7",periodIds:["p-16"],placeIds:["pl-a"],eventSessionId:"2a1aab7a"},{id:"a91a72f9",periodIds:["p-16"],placeIds:["pl-1"],eventSessionId:"cb00cabe"},{id:"152c3ef4",periodIds:["p-17"],placeIds:["pl-a","pl-1"],event:{id:"152c3ef4",title:"Lunch"}},{id:"8618f467",periodIds:["p-18"],placeIds:["pl-a"],eventSessionId:"0e289e8a"},{id:"671d355d",periodIds:["p-18"],placeIds:["pl-1"],eventSessionId:"f6aab845"},{id:"9e85f733",periodIds:["p-19"],placeIds:["pl-a"],eventSessionId:"cbd45b89"},{id:"edd32b3a",periodIds:["p-19"],placeIds:["pl-1"],eventSessionId:"91f5ee6c"},{id:"dc8ce7da",periodIds:["p-20"],placeIds:["pl-a"],eventSessionId:"ffc19803"},{id:"89b3356e",periodIds:["p-20"],placeIds:["pl-1"],eventSessionId:"65afbad7"},{id:"ed06045b",periodIds:["p-21"],placeIds:["pl-a"],eventSessionId:"874146e0"},{id:"a3e0b09a",periodIds:["p-21"],placeIds:["pl-1"],eventSessionId:"c95d4543"},{id:"b5970105",periodIds:["p-22"],placeIds:["pl-a","pl-1"],event:{id:"b5970105",title:"Tea Time"}},{id:"18513316",periodIds:["p-23"],placeIds:["pl-a"],eventSessionId:"0972d8ad"},{id:"b506e38f",periodIds:["p-23"],placeIds:["pl-1"],eventSessionId:"8ae0be0c"},{id:"f32222f8",periodIds:["p-24"],placeIds:["pl-a","pl-1"],eventSessionId:"62e21cbb"},{id:"8526de48",periodIds:["p-25"],placeIds:["pl-a","pl-1"],event:{id:"8526de48",title:"Closing"}}]}};

const getData = confData => dataType => Object.values(confData).map(data => data[dataType]).flatten();
const langMap = {
  'zh-TW': 'ZH_TW',
  'en': 'EN',
};
