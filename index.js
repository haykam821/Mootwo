'use strict';

const repl = require('repl');
const io = require('socket.io');

let randInt = (min, max) => Math.floor(Math.random() * (max - min)) + min;
let randChoose = choices => choices[randInt(0, choices.length)];
class Player {
  constructor(server, id) {
    let config = server.config;
    this.id = id;
    this.clan = null;
    this.server = server;
    this.untilSend = 1;

    this.name = 'unknown';
    this.skin = 0;
    this.size = config.playerScale;
    
    this.aimAngle = 0;
    this.movement = null;
    this.kill();
  }
  updateMovement(delta) {
    let config = this.server.config;
    let tx = 0;
    let ty = 0;
    if (this.movement != null) {
      tx = Math.cos(this.movement);
      ty = Math.sin(this.movement);
    }
    this.vx *= Math.pow(config.playerDecel, delta);
    this.vy *= Math.pow(config.playerDecel, delta);
    this.vx += tx * config.playerSpeed * delta * this.size / 2;
    this.vy += ty * config.playerSpeed * delta * this.size / 2;
    this.x += this.vx;
    this.y += this.vy;
  }
  update(delta) {
    if (this.alive) {
      this.updateMovement(delta);
      this.untilSend--;
      if (!this.untilSend) {
        this.untilSend = this.server.config.clientSendRate;
        this.sendPosition();
      }
    }
  }
  sendPosition() {
    let socket = this.socket;
    socket.emit('a');
    socket.emit('3', [
      this.id,
      this.x,
      this.y, -2.26,-1,0,0,null,0,0,0,0]);
  }
  link(socket) {
    this.socket = socket;
    socket.once('error', err => {
      console.log(err);
      this.destroy();
    });
    socket.on('2', angle => this.aimAngle = angle);
    socket.on('3', angle => this.movement = angle);
    
    socket.on("14",function(data){
        console.log('ping!!!', arguments)
        emit("p",x,y)
    });
    
    socket.once('disconnect', () => this.destroy());
    socket.emit('id', {
      teams: this.server.clans
    });
    socket.on('1', data => {
      this.name = data.name.length > 15 || !data.name ? 'unknown' : data.name;
      this.skin = data.skin;
      this.spawn();
    });
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
    let config = this.server.config;
    let socket = this.socket;
    this.alive = true;
    let { x, y } = this.server.allocatePosition(this.size);
    this.x = x;
    this.y = y;
    this.slowDown();
    socket.emit('1', this.id);
    socket.emit('2', [socket.id,this.id,this.name,this.x,this.y,0,100,100,this.size,this.skin],true);
  }
  hitResource(type) {
    
  }
}
class Resource {
  constructor(server, x, y, size, type) {
    let config = server.config;
    this.x = x;
    this.y = y;
    this.type = config.resourceTypes.indexOf(type);
    this.size = size;
  }
  reward(by) {
    by.hitResource(this.type);
  }
}
class Server {
  constructor(config) {
    this.config = config;
    this.players = Array(config.maxPlayers).fill(null);
    this.lastRun = Date.now();
    this.clans = [];
    this.objects = [];
    setInterval(() => this.update(), config.serverUpdateRate);
    this.generateWorld();
  }
  remove(sid) {
    this.players[sid] = null;
  }
  update() {
    let now = Date.now();
    let delta = now - this.lastRun;
    this.lastRun = now;
    for (let i of this.players) {
      if (i != null) {
        i.update(delta);
      }
    }
  }
  generateWorld() {
    let config = this.config;
    let areaCount = config.areaCount;
    let mapScale = config.mapScale;
    let areaSize = mapScale / areaCount;
    let all = [];
    for (let afx = 0, atx = 1; afx < areaCount; afx++, atx++) {
      for (let afy = 0, aty = 1; afy < areaCount; afy++, aty++) {
        for (let i = 0; i < config.treesPerArea; i++) {
          let x = randInt(areaSize * afx, areaSize * atx);
          let y = randInt(areaSize * afy, areaSize * aty);
          all.push(new Resource(this, x, y, randChoose(config.treeScales), 'wood'));
        }
        for (let i = 0; i < config.bushesPerArea; i++) {
          let x = randInt(areaSize * afx, areaSize * atx);
          let y = randInt(areaSize * afy, areaSize * aty);
          all.push(new Resource(this, x, y, randChoose(config.bushScales), 'food'));
        }
      }
    }
    for (let i = 0; i < config.totalRocks; i++) {
      let x = randInt(0, mapScale);
      let y = randInt(0, mapScale);
      all.push(new Resource(this, x, y, randChoose(config.rockScales), 'stone'));
    }
    for (let i = 0; i < config.goldOres; i++) {
      let x = randInt(0, mapScale);
      let y = randInt(0, mapScale);
      all.push(new Resource(this, x, y, 0, 'points'));
    }
    this.objects = all;
  }
  allocatePosition(size) {
    let scale = this.config.mapScale;
    let x = 0;
    let y = 0;
    while (true) {
      x = randInt(0, scale);
      y = randInt(0, scale);
      if (true) { // check if there's nothing overlapping
        break;
      }
    }
    return { x, y };
  }
  handle(socket) {
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i] == null) {
        let player = new Player(this, i);
        player.link(socket);
        this.players[i] = player;
        break;
      }
    }
  }
}

let app = new Server({
  mapScale: 14400,
  maxPlayers: 50,
  clientSendRate: 5,
  serverUpdateRate: 9,
  playerDecel: 0.993,
  playerSpeed: 0.0016,
  playerScale: 35,
  areaCount: 7,
  treesPerArea: 9,
  bushesPerArea: 3,
  totalRocks: 32,
  goldOres: 7,
  resourceTypes: ['wood', 'food', 'stone', 'points'],
  treeScales: [140, 145, 150, 155],
  bushScales: [80, 85, 95],
  rockScales: [80, 85, 90],
});

for (let i = 5000; i <= 5010; i++) {
  io(i).on('connection', socket => app.handle(socket));
}
/*
let teams = [];
let sockets = [];
  io(i).on('connection', function (socket) {
    let emit = (...arg) => {
      try {
        socket.broadcast.emit(...arg);
        socket.emit(...arg);
      } catch (e) {
        sockets.forEach(a => a.emit(...arg));
      }
    };
    sockets.push(socket);
    socket.on('1', function (data) {
      let id = 27;
      let name = data.name.length > 15 ? 'unknown' : data.name;
      socket.emit('id', {
        "teams": teams
      });
      socket.emit('1', id);
      socket.emit('mm', 0);
      socket.emit('3', []);
      let x = randInt(0, config.mapScale);
      let y = randInt(0, config.mapScale);
      let userteam = null;
      let last = 0;
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
        let userteam = data;
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
        let speed = y > 2400 ? 60 * 0.8 : 60;
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
