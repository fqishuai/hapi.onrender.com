'use strict';

const Hapi = require('@hapi/hapi');
const Bcrypt = require('bcrypt');
const Iron = require('@hapi/iron');

const internals = {};


// Simulate database for demo

internals.users = [
  {
    id: 1,
    name: 'john',
    password: '$2a$10$iqJSHD.BGr0E2IxQwYgJmeP3NvhPrXAeLSaGCj6IR/XU5QtjVu5Tm',   // 'secret'
  },
];

Bcrypt.hash('secret', 10, function(err, hash) {
  // Store hash in your password DB.
  console.log('hash: ', hash)
});

internals.renderHtml = {
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


internals.server = async function () {

  const server = Hapi.server({ port: 4000, host: 'localhost' });

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
      console.log('session cookie: ', session) // session cookie:  { id: 1 }
      const unseal = await Iron.unseal(
        'Fe26.2**6385f16d3746b5c3f7acc5d49cdd9eb4d04454e08b07fda211f98ed7d953c0ec*L_qxkbu3iUexV6P5I1vJvA*5JtC_MPPQq3WfN7m9YuYwA**41df5cdeaee532c96b89b35670c5653261766642803719879de272f417bc32e1*pSacjR7Fh6AZE8Ap8sEeEMYRB4Feci5AbdAVUhUk-RE',
        'password-should-be-32-characters',
        Iron.defaults
      );
      console.log('unseal: ', unseal) // unseal:  { id: 1 }
      const account = internals.users.find((user) => (user.id === session.id));

      if (!account) {
        // Must return { isValid: false } for invalid cookies
        return { isValid: false };
      }

      return { isValid: true, credentials: account };
    }
  });

  server.auth.default('session');

  server.route([
    {
      method: 'GET',
      path: '/',
      options: {
        handler: (request, h) => {
          return internals.renderHtml.home(request.auth.credentials.name);
        }
      }
    },
    {
      method: 'GET',
      path: '/login',
      options: {
        auth: {
          mode: 'try'
        },
        plugins: {
          cookie: {
            redirectTo: false
          }
        },
        handler: async (request, h) => {
          if (request.auth.isAuthenticated) {
            return h.redirect('/');
          }

          return internals.renderHtml.login();
        }
      }
    },
    {
      method: 'POST',
      path: '/login',
      options: {
        auth: {
          mode: 'try'
        },
        handler: async (request, h) => {
          const { username, password } = request.payload;
          if (!username || !password) {
            return internals.renderHtml.login('Missing username or password');
          }

          // Try to find user with given credentials

          const account = internals.users.find(
            (user) => user.name === username
          );

          if (!account || !(await Bcrypt.compare(password, account.password))) {
            return internals.renderHtml.login('Invalid username or password');
          }

          request.cookieAuth.set({ id: account.id });
          return h.redirect('/');
        }
      }
    },
    {
      method: 'GET',
      path: '/logout',
      options: {
        handler: (request, h) => {
          request.cookieAuth.clear();
          return h.redirect('/');
        }
      }
    }
  ]);

  await server.start();
  console.log(`Server started at: ${server.info.uri}`);
};


internals.start = async function () {
  try {
    await internals.server();
  }
  catch (err) {
    console.error(err.stack);
    process.exit(1);
  }
};

internals.start();