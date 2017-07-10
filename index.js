var repl = require('repl');
var io = require('socket.io');

var randInt = (min, max) => {
  return Math.floor(Math.random() * (max - min)) + min;
};
class Player {
  constructor(server, id) {
    this.config = server.config;
    this.id = id;
    this.clan = null;
    this.server = server;
    this.kill();
  }
  update(delta) {
    if (this.alive) {
      this.x += this.vx;
      this.y += this.vy;
      this.xv *= Math.pow(this.config.playerDecel, delta);
      this.yv *= Math.pow(this.config.playerDecel, delta);
    } 
  }
  link(socket) {
    this.socket = socket;
    socket.once('error', err => {
      console.log(err);
      this.destroy();
    })
    socket.once('disconnect', () => this.destroy());
  }
  destroy() {
    this.kill();
    this.server.remove(this.id);
    this.socket.disconnect();
  }
  kill() {
    this.alive = false;
    this.x = 0;
    this.y = 0;
    this.slowDown();
  }
  slowDown() {
    this.vx = 0;
    this.vy = 0;
  }
  spawn() {
    this.alive = true;
    this.x = randInt(0, config.mapScale);
    this.y = randInt(0, config.mapScale);
    this.slowDown();
  }
}
class Server {
  constructor(config) {
    this.config = config;
    this.players = Array(config.maxPlayers).fill(null);
    this.lastRun = Date.now();
    setInterval(() => this.update(), config.serverUpdateRate);
  }
  remove(sid) {
    this.players[sid] = null;
  }
  update() {
    var now = Date.now();
    var delta = this.lastRun - now;
    this.lastRun = now;
    for (var i of this.players) {
      if (i != null) {
        i.update(delta);
      }
    }
  }
  handle(connection) {
    for (var i = 0; i < 50; i++) {
      if (this.players[i] == null) {
        this.players[i] = new Player(this, i).link(connection);
        break;
      }
    }
  }
}

var app = new Server({
  mapScale: 14400,
  maxPlayers: 50,
  serverUpdateRate: 9,
});

for (var i = 5000; i <= 5010; i++) {
  io(i).on('connection', socket => app.handle(socket));
}
/*
var teams = [];
var sockets = [];
  io(i).on('connection', function (socket) {
    var emit = (...arg) => {
      try {
        socket.broadcast.emit(...arg);
        socket.emit(...arg);
      } catch (e) {
        sockets.forEach(a => a.emit(...arg));
      }
    };
    sockets.push(socket);
    socket.on('1', function (data) {
      var id = 27;
      var name = data.name.length > 15 ? 'unknown' : data.name;
      socket.emit('id', {
        "teams": teams
      });
      socket.emit('1', id);
      socket.emit('mm', 0);
      socket.emit('3', []);
      var x = randInt(0, config.mapScale);
      var y = randInt(0, config.mapScale);
      var userteam = null;
      var last = 0;
      socket.emit("2", ["a3Pm5dMzeKOjc5gvAJEF", id, name, x, 7200, 0, 100, 100, 35, data.skin], true);
      socket.emit("5", [27, data.name, 9001]); //[5,"<b>RIP</b>",31988,45,"KADEJO503",23404,34,"winter wolf",4821,28,"Godenot",4500,33,"Arena Closer",3000,32,"LightTheif",2940,6,"CarlosKoS-_-16",2800,4,"GD desconhecido",2635,35,"jack black GD",2357,19,"AMIGO BOM",1623])
      socket.emit("6", [
        29, 3115.1, 13592.9, 0, 109.2, 1, null, -1,
        353, 4103, 13436, 0, 80, 2, null, -1,
        339, 2498, 14155, 0, 90, 2, null, -1
      ]);
      socket.emit("8", 2.6, 28);
      socket.on("ch", data => {
        emit("ch", id, data);
      });
      socket.on("8", data => {
        console.log('CLAN CREATE REQUEST:', data);
        teams.push([{
          "sid": data,
          "owner": id
        }]);
        var userteam = data;
        emit("st", data, true);
      });
      socket.on("3", function (data) {
        if (data == null) {
          vx = vy = 0;
          return;
        } else if (x < 0 || x > config.mapScale || y < 0 || y > config.mapScale) {
          x = 7200;
          y = 7200;
        }
        if (y >= 6840 && y <= 7560) {
          x += 0.44;
        }
        var speed = y > 2400 ? 60 * 0.8 : 60;
        vx = Math.cos(data) * speed;
        vy = Math.sin(data) * speed;
        x += vx;
        y += vy;
        socket.emit('a');
        socket.emit("3", [id, x, y, -2.26, -1, 0, 0, null, 0, 0, 0, 0]);
      });
      socket.on("14", function (data) {
        console.log('ping!!!', arguments);
      });
    });
  });
}
*/
repl.start({
  eval: (a, _c, _f, cb) => {
    try {
      cb(null, eval(a)); // jshint ignore: line
    } catch (e) {
      cb(e);
    }
  }
});
