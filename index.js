'use strict';

const repl = require('repl');
const io = require('socket.io');

let randInt = (min, max) => Math.floor(Math.random() * (max - min)) + min;
let randChoose = choices => choices[randInt(0, choices.length)];

function parseFlags(string, flagsArray) {
  if (!Array.isArray(flagsArray)) {
    return { error: 'Array of flags not found.' };
  }
  let returnObject = {};
  let flagLocations = [[-1, 'null', []]];
  let stringArray = string.split(' ');
  for (let i = 0; i < stringArray.length; i++) {
    if (flagsArray.indexOf(stringArray[i]) > -1) {
      flagLocations.push([i, stringArray[i], []]);
    } else {
      flagLocations[flagLocations.length - 1][2].push(stringArray[i]);
    }
  }
  for (let i = 0; i < flagLocations.length; i++){
    returnObject[flagLocations[i][1].replace(/^(-*)/g, '')] = {
      flagLocation: flagLocations[i][0],
      value: flagLocations[i][2].join(' '),
    };
  }
  return returnObject;
}

function flatten(arr) {
  return arr.reduce((flat, toFlatten) =>
    flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten)
  , []);
}

class Player {
  constructor(server, id) {
    let config = server.config;
    this.id = id;
    this.clan = null;
    this.server = server;
    this.alive = false;
    this.lastPing = new Date('Sat, 08 Jul 2017 01:07:11 GMT').getTime();

    this.name = 'unknown';
    this.dev = false;
    this.skin = 0;
    this.size = config.playerScale;
    this.viewedObjects = [];
    this.food = this.wood = this.stone = this.points = 0;

    this.aimAngle = 0;
    this.movement = null;
    this.attacking = false;
    this.autoAttack = false;
    this.kill();
    this.attackReady = true;
    this.attackInterval = null;
    this.attackTimeout = null;
    this.attackCooldown = 500;

    this.x = this.y = this.vx = this.vy = 0;
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
    (this.x < this.size) && (this.x = this.size + 1, this.xv = Math.max(this.xv, 0));
    (this.x > config.mapScale - this.size) && (this.x = config.mapScale - this.size - 1, this.xv = Math.min(this.xv, 0));
    (this.y < this.size) && (this.y = this.size + 1, this.yv = Math.max(this.yv, 0));
    (this.y > config.mapScale - this.size) && (this.y = config.mapScale - this.size - 1, this.yv = Math.min(this.yv, 0));
  }
  update(delta, send) {
    if (this.alive) {
      this.updateMovement(delta);
      if (send) {
        this.sendPosition();
      }
    }
  }
  peek() {
    let old = this.viewedObjects;
    let view = this.server.viewObjects(this.x, this.y);
    let sending = [];
    for (let i of view) {
      if (old[i.id]) continue;
      old[i.id] = true;
      sending.push(...i.data);
    }
    if (sending.length) this.socket.emit('6', sending)
  }
  sendPosition() {
    let socket = this.socket;
    this.peek();
    socket.emit('a');
    socket.emit('3', [
      this.id,
      this.x,
      this.y, -2.26,-1,0,0,null,0,0,0,0]);
  }
  link(socket) {
    let config = this.server.config;
    this.socket = socket;
    socket.once('error', err => {
      console.log(err);
      this.destroy();
    });

    let emitAll = (...arg) => {
      try {
        socket.broadcast.emit(...arg)
        socket.emit(...arg)
      } catch (e) {
      }
    }

    socket.on('2', angle => this.aimAngle = angle);
    socket.on('3', angle => this.movement = angle);

    socket.on('14', data => {
      let now = Date.now();
      let dif = now - this.lastPing;
      if (dif > config.mapPingTime) {
        this.lastPing = now;
        emitAll('p', this.x, this.y);
      }
    });

    socket.on("4", data => {
      if (data == 0){
        this.attacking = this.autoAttack === true ? true : false;
      }else{
        this.attacking = true;
      }
      if (this.attacking === true){
        this.attackInterval = setInterval(() => {
          if (this.attacking === true){
            if (this.attackReady === true){
              socket.emit("7", this.id, 0, 0);
              this.attackReady = false;
              this.attackTimeout = setTimeout(() => {this.attackReady = true;}, this.attackCooldown);
            }
          }
        });
      }else{
        clearInterval(this.attackInterval);
      }
    });

    socket.on("7", data => {
      if (data == 1){
        this.autoAttack = !this.autoAttack;
        this.attacking = this.autoAttack === true ? true : false;
      }
      if (this.autoAttack === true){
        this.attackInterval = setInterval(() => {
          if (this.attacking === true){
            if (this.attackReady === true){
              socket.emit("7", this.id, 0, 0);
              this.attackReady = false;
              this.attackTimeout = setTimeout(() => {this.attackReady = true;}, this.attackCooldown);
            }
          }
        });
      }else{
        clearInterval(this.attackInterval);
      }
    });

    socket.on('ch', msg => {
      do {
        if (msg.startsWith('login ')) {
          let password = msg.split(' ').slice(1).join(' ');
          if (password === this.server.config.devPassword) {
            this.dev = {};
            socket.emit('ch', this.id, 'Logged in as Dev!');
            return;
          }
          break;
        }
        if (!this.dev || !msg.startsWith('sudo ')) break;
        socket.emit('ch', this.id, msg);
        let command = msg.split(' ')[1];
        let argString = msg.split(' ').slice(2).join(' ');
        if (command === 'teleport') {
          let args = parseFlags(argString, ['-x', '-y', '-p']); //x-coord, y-coord, player
          if (typeof args !== 'undefined' && args.p) {
            let filtered = this.server.players.filter(p => p.name === args.p.value);
            if (filtered.length > 0) {
              this.x = filtered[0].x;
              this.y = filtered[0].y;
            }
          } else if (typeof args !== 'undefined' && (args.x || args.y)) {
            args.x && !isNaN(args.x.value) && (this.x = parseFloat(args.x.value));
            args.y && !isNaN(args.y.value) && (this.y = parseFloat(args.y.value));
          }
        } else if (command === 'setpts') {
          let args = parseFlags(argString, ['-n', '-p']); //number points, player target (defaults to user)
          if (typeof args !== 'undefined' && args.n && args.p && !isNaN(args.n.value)) {
            let filtered = this.server.players.filter(p => p.name === args.p.value);
            if (filtered.length > 0 && filtered[0].socket) {
              filtered[0].points = parseInt(args.n.value);
              filtered[0].socket.emit('9', 'points', filtered[0].points, 1);
            }
          } else if (typeof args !== 'undefined' && args.n) {
            args.n && !isNaN(args.n.value) && (this.points = parseInt(args.n.value));
            socket.emit('9', 'points', this.points, 1);
          }
        } else if (command === 'fat') {
          let args = parseFlags(argString, ['-q']); //quiting being fat fat
          if (typeof args !== 'undefined' && args.q) {
            this.size = config.playerScale;
          } else if (typeof args !== 'undefined') {
            this.size = config.playerScale * 2;
          }
        }
        return;
      } while (false);
      emitAll('ch', this.id, msg);
    });
    socket.once('disconnect', () => this.destroy());
    socket.emit('id', {
      teams: this.server.clans
    });
    socket.on('1', data => {
      this.name = data.name.length > 15 || !data.name ? 'unknown' : data.name;
      this.skin = data.skin;
      this.spawn();
      this.peek();
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
  constructor(server, id, x, y, size, type) {
    let config = server.config;
    this.x = x;
    this.y = y;
    this.id = id;
    this.type = config.resourceTypes.indexOf(type);
    this.size = size;
    this.angle = (Math.random() - 0.5) * Math.PI;
    this.init();
  }
  reward(by) {
    by.hitResource(this.type);
  }
  init() {
    this.data = [
      this.id,
      this.x,
      this.y,
      this.angle,
      this.size,
      this.type,
      null,
      -1,
    ];
  }
}
class Server {
  constructor(config) {
    this.config = config;
    this.players = Array(config.maxPlayers).fill(null);
    this.untilSend = 1;
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
    var send = false;
    if (!(--this.untilSend)) {
      this.untilSend = this.config.clientSendRate;
      send = true;
    }
    let now = Date.now();
    let delta = now - this.lastRun;
    this.lastRun = now;
    let leaderboard = [];
    for (let i of this.players) {
      if (i == null) continue;
      i.update(delta, send);
      if (send && i.alive === true && i.name !== null){
        leaderboard.push([i.id, i.name, i.points]);
      }
    }
    if (send) {
      leaderboard.sort((a, b) => a[2] - b[2]);
      leaderboard = flatten(leaderboard);
      this.players.forEach(r => r && r.socket.emit('5', leaderboard));
    }
  }
  viewObjects(x, y) {
    let config = this.config;
    let visibles = [];
    let width = config.maxScreenWidth;
    let height = config.maxScreenHeight;
    for (let i of this.objects)
      if (
        i.y + height > y &&
        i.y - height < y &&
        i.x + width > x &&
        i.x - width < x
      ) visibles.push(i);
    return visibles;
  }
  viewPlayers(x, y) {
    let config = this.config;
    let visibles = [];
    let width = config.maxScreenWidth;
    let height = config.maxScreenHeight;
    for (let i of this.players)
      if (
        i.y + height > y &&
        i.y - height < y &&
        i.x + width > x &&
        i.x - width < x
      ) visibles.push(i);
    return visibles;
  }
  generateWorld() {
    let config = this.config;
    let areaCount = config.areaCount;
    let mapScale = config.mapScale;
    let riverWidth = config.riverWidth;
    let areaSize = mapScale / areaCount;
    let all = [];
    let id = 0;
    for (let afx = 0, atx = 1; afx < areaCount; afx++, atx++) {
      for (let afy = 0, aty = 1; afy < areaCount; afy++, aty++) {
        for (let i = 0; i < config.treesPerArea; i++) {
          let x = randInt(areaSize * afx, areaSize * atx);
          let y = randInt(areaSize * afy, areaSize * aty);
          if (y < mapScale - config.snowBiomeTop && (
              y > (mapScale + riverWidth) / 2 ||
              y < (mapScale - riverWidth) / 2)
            ) all.push(new Resource(this, id++, x, y, randChoose(config.treeScales), 'wood'));
        }
        for (let i = 0; i < config.bushesPerArea; i++) {
          let x = randInt(areaSize * afx, areaSize * atx);
          let y = randInt(areaSize * afy, areaSize * aty);
          if (y > (mapScale + riverWidth) / 2 ||
              y < (mapScale - riverWidth) / 2
            ) all.push(new Resource(this, id++, x, y, randChoose(config.bushScales), 'food'));
        }
      }
    }
    for (let i = 0; i < config.totalRocks; i++) {
      let x = randInt(0, mapScale);
      let y = randInt(0, mapScale);
      all.push(new Resource(this, id++, x, y, randChoose(config.rockScales), 'stone'));
    }
    for (let i = 0; i < config.goldOres; i++) {
      let x = randInt(0, mapScale);
      let y = randInt(0, mapScale);
      if (y > (mapScale + riverWidth) / 2 ||
          y < (mapScale - riverWidth) / 2
      ) {
        i--;
        continue;
      }
      all.push(new Resource(this, id++, x, y, randChoose(config.rockScales), 'points'));
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
  maxScreenWidth: 1920,
  maxScreenHeight: 1080,
  snowBiomeTop: 2400,
  riverWidth: 724,
  mapPingTime: 2200,
  devPassword: 'PASSWORD'
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
        'teams': teams
      });
      socket.emit('1', id);
      socket.emit('mm', 0);
      socket.emit('3', []);
      let x = randInt(0, config.mapScale);
      let y = randInt(0, config.mapScale);
      let userteam = null;
      let last = 0;
      socket.emit('2', ['a3Pm5dMzeKOjc5gvAJEF', id, name, x, 7200, 0, 100, 100, 35, data.skin], true);
      socket.emit('5', [27, data.name, 9001]); //[5,'<b>RIP</b>',31988,45,'KADEJO503',23404,34,'winter wolf',4821,28,'Godenot',4500,33,'Arena Closer',3000,32,'LightTheif',2940,6,'CarlosKoS-_-16',2800,4,'GD desconhecido',2635,35,'jack black GD',2357,19,'AMIGO BOM',1623])
      socket.emit('6', [
        29, 3115.1, 13592.9, 0, 109.2, 1, null, -1,
        353, 4103, 13436, 0, 80, 2, null, -1,
        339, 2498, 14155, 0, 90, 2, null, -1
      ]);
      socket.emit('8', 2.6, 28);
      socket.on('ch', data => {
        emit('ch', id, data);
      });
      socket.on('8', data => {
        console.log('CLAN CREATE REQUEST:', data);
        teams.push([{
          'sid': data,
          'owner': id
        }]);
        let userteam = data;
        emit('st', data, true);
      });
      socket.on('3', function (data) {
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
        socket.emit('3', [id, x, y, -2.26, -1, 0, 0, null, 0, 0, 0, 0]);
      });
      socket.on('14', function (data) {
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
