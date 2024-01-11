'use strict';

const Hapi = require('@hapi/hapi');
const Bcrypt = require('bcrypt');
const Dotenv = require('dotenv');

Dotenv.config();

server.log('test DATABASE_URL', process.env.DATABASE_URL);
server.log('test HOST', process.env.HOST);
server.log('test PORT', process.env.PORT);

// Simulate database for demo
const users = [
  {
    id: 1,
    name: 'john',
    password: '$2a$10$iqJSHD.BGr0E2IxQwYgJmeP3NvhPrXAeLSaGCj6IR/XU5QtjVu5Tm',   // 'secret'
  },
];

const renderHtml = {
  login: (message) => {
    return `
    <html><head><title>Login page</title></head><body>
    ${message ? '<h3>' + message + '</h3><br></a>' : ''}
    <form method="post" action="/login">
      Username: <input type="text" name="username"><br>
      Password: <input type="password" name="password"><br></a>
    <input type="submit" value="Login"></form>
    </body></html>
      `;
  },
  home: (name) => {
    return `
    <html><head><title>Login page</title></head><body>
    <h3>Welcome ${name}! You are logged in!</h3>
    <form method="get" action="/logout">
      <input type="submit" value="Logout">
    </form>
    </body></html>
      `;
  }
};

const init = async function () {
  const server = Hapi.server({ host: process.env.HOST, port: process.env.PORT });

  await server.register(require('@hapi/cookie'));

  server.auth.strategy('session', 'cookie', {
    cookie: {
      name: 'sid-example',

      // Don't forget to change it to your own secret password!
      password: 'password-should-be-32-characters',

      // For working via HTTP in localhost
      isSecure: false
    },

    redirectTo: '/login',

    validate: async (request, session) => {
      const account = users.find((user) => (user.id === session.id));

      if (!account) {
        // Must return { isValid: false } for invalid cookies
        return { isValid: false };
      }

      return { isValid: true, credentials: account };
    }
  });

  server.auth.default('session');

  await server.register({
    plugin: require('hapi-mongodb'),
    options: {
      url: process.env.DATABASE_URL,
      settings: {
        useUnifiedTopology: true
      },
      decorate: true
    }
  });

  server.route([
    // 首页
    {
      method: 'GET',
      path: '/',
      handler: (request, h) => {
        return renderHtml.home(request.auth.credentials.name);
      }
    },
    // 登入登出
    {
      method: 'GET',
      path: '/login',
      handler: async (request, h) => {
        if (request.auth.isAuthenticated) {
          return h.redirect('/');
        }

        return renderHtml.login();
      },
      options: {
        auth: {
          mode: 'try'
        },
        plugins: {
          cookie: {
            redirectTo: false
          }
        },
      }
    },
    {
      method: 'POST',
      path: '/login',
      handler: async (request, h) => {
        const { username, password } = request.payload;
        if (!username || !password) {
          return renderHtml.login('Missing username or password');
        }

        // Try to find user with given credentials

        const account = users.find(
          (user) => user.name === username
        );

        if (!account || !(await Bcrypt.compare(password, account.password))) {
          return renderHtml.login('Invalid username or password');
        }

        request.cookieAuth.set({ id: account.id });
        return h.redirect('/');
      },
      options: {
        auth: {
          mode: 'try'
        },
      }
    },
    {
      method: 'GET',
      path: '/logout',
      handler: (request, h) => {
        request.cookieAuth.clear();
        return h.redirect('/');
      }
    },
    // 获取一个todo事项
    {
      method: 'GET',
      path: '/todo',
      handler: async (request, h) => {
        const todo = await request.mongo.db.collection('todolists').findOne({})
  
        return todo;
      }
    }
  ]);

  await server.start();
  console.log(`Server started at: ${server.info.uri}`);
};


const start = async function () {
  try {
    await init();
  }
  catch (err) {
    console.error(err.stack);
    process.exit(1);
  }
};

start();