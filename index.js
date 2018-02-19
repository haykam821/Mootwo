'use strict';

const repl = require('repl');
const io = require('socket.io');
const ws = require('ws');

const funcs = require("./funcs.js");

let randInt = funcs.randInt;
let randChoose = funcs.randItem;
let genderateExecutor = funcs.makeEvalImage;
let flatten = funcs.flatten;
let idGenerator = funcs.idGenerator;

var buildings = {
  0: { //apple
    age: 1,
    cost: {
      food: 10
    },
    playerHeal: 20,
    holdOffset: 15,
    size: 22
  },
  1: { //cookie
    age: 3,
    cost: {
      food: 15
    },
    playerHeal: 40,
    holdOffset: 15,
    size: 27
  },
  2: { //wood wall
    age: 1,
    cost: {
      wood: 15
    },
    health: 350,
    holdOffset: 20,
    placeOffset: -5,
    size: 50
  },
  3: { //stone wall
    age: 3,
    cost: {
      stone: 25
    },
    health: 900,
    holdOffset: 20,
    placeOffset: -5,
    size: 50
  },
  4: { //castle wall
    age: 7,
    prereq: 3,
    cost: {
      stone: 35
    },
    health: 1500,
    holdOffset: 20,
    placeOffset: -5,
    size: 52
  },
  5: { //spikes
    age: 1,
    cost: {
      wood: 20,
      stone: 5
    },
    health: 400,
    damage: 20,
    holdOffset: 8,
    placeOffset: -5,
    padding: -23,
    size: 49
  },
  6: { //greater spikes
    age: 5,
    cost: {
      wood: 30,
      stone: 10
    },
    health: 500,
    damage: 40,
    holdOffset: 8,
    placeOffset: -5,
    padding: -23,
    size: 52
  },
  7: { //windmill
    age: 1,
    cost: {
      wood: 50,
      stone: 10
    },
    health: 400,
    pps: 1,
    holdOffset: 20,
    placeOffset: 5,
    padding: 25,
    size: 45
  },
  8: { //faster windmill
    age: 5,
    cost: {
      wood: 60,
      stone: 20
    },
    health: 500,
    pps: 1.5,
    holdOffset: 20,
    placeOffset: 5,
    padding: 25,
    size: 47
  },
  9: { //mine
    age: 5,
    cost: {
      wood: 20,
      stone: 100
    },
    baseResourcesPerHit: {
      stone: 1
    },
    holdOffset: 20,
    placeOffset: 0,
    size: 65
  },
  10: { //pit trap
    age: 4,
    cost: {
      wood: 30,
      stone: 30
    },
    collision: false,
    trap: true,
    hiddenFromEnemy: true,
    health: 700,
    holdOffset: 20,
    placeOffset: -5,
    size: 50
  },
  11: { //boost pad
    age: 4,
    cost: {
      wood: 5,
      stone: 30
    },
    health: 400,
    boost: 1.5,
    holdOffset: 20,
    placeOffset: -5,
    size: 45
  },
  12: { //turret
    age: 7,
    cost: {
      wood: 200,
      stone: 150
    },
    health: 800,
    projectileRange: 700,
    projectileReload: 2200,
    holdOffset: 20,
    placeOffset: -5,
    size: 43
  },
  13: { //platforms
    age: 7,
    cost: {
      wood: 20
    },
    collision: false,
    health: 300,
    holdOffset: 20,
    placeOffset: -5,
    size: 43
  }
};

function parseFlags(string, flagsArray) {
  if (!Array.isArray(flagsArray)) {
    return {
      error: 'Array of flags not found.'
    };
  }
  let returnObject = {};
  let flagLocations = [
    [-1, 'null', []]
  ];
  let stringArray = string.split(' ');
  for (let i = 0; i < stringArray.length; i++) {
    if (flagsArray.indexOf(stringArray[i]) > -1) {
      flagLocations.push([i, stringArray[i],
        []
      ]);
    } else {
      flagLocations[flagLocations.length - 1][2].push(stringArray[i]);
    }
  }
  for (let i = 0; i < flagLocations.length; i++) {
    returnObject[flagLocations[i][1].replace(/^(-*)/g, '')] = {
      flagLocation: flagLocations[i][0],
      value: flagLocations[i][2].join(' '),
    };
  }
  return returnObject;
}

const Clan = require("./classes.js").clan;
const Player = require("./classes.js").player;
const Vector = require("./classes.js").vector;

class Resource {
  constructor(server, id, v, size, type) {
    this.server = server;
    this.pos = v;
    this.id = id;
    this.type = server.config.resourceTypes.indexOf(type);
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
      ...this.pos,
      this.angle,
      this.size,
      this.type,
      null, -1,
    ];
  }
}

class Building {
  constructor(server, pos, buildingType) {
    this.server = server;
    this.pos = pos;
    this.buildingType = buildingType;
    this.id = server.buildingIDGenerator.next().value;
  }
  damage(dmg) {

  }
}

class Server {
  constructor(config) {
    this.config = config;
    this.players = Array(config.maxPlayers).fill(null);
    this.untilSend = 1;
    this.lastRun = Date.now();
    this.clans = {};
    this.objects = [];
    this.resourceIDGenerator = idGenerator();
    this.buildingIDGenerator = idGenerator();
    this.init();
  }
  addClan(n) {
    if (this.clans[n.name]) return true;
    this.clans[n.name] = n;
  }
  removeClan(n) {
    if (this.clans[n.name]) {
      this.clans[n.name] = null;
    }
  }
  init() {
    setInterval(() => this.update(), this.config.serverUpdateRate);
    this.generateWorld();
    this.server = [];
    let wss = new ws.Server({
      port: 5050
    });
    wss.on('connection', ws => {
      let id = ws.protocol.replace(/[^0-9A-Za-z_\-]/g, '');
      for (let i of this.players) {
        if (i && i.socket && i.socket.id == id) {
          this.handleEval(i, ws);
          break;
        }
      }
    });
    this.evalWss = wss;
    for (let i = 5000; i <= 5010; i++) {
      io(i).on('connection', socket => this.handleSocket(socket));
    }
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
      if (send && i.alive === true && i.name !== null) {
        leaderboard.push(i.id, i.name, i.points);
      }
    }
    if (send) {
      leaderboard.sort((a, b) => b[2] - a[2]);
      this.players.forEach(r => r && r.alive && r.socket.emit('5', leaderboard));
    }
  }
  broadcast(...arg) {
    this.players.forEach(r => r && r.socket.connected && r.socket.emit(...arg));
  }
  viewObjects(v) {
    let config = this.config;
    let visibles = [];
    let width = config.maxScreenWidth;
    let height = config.maxScreenHeight;
    for (let i of this.objects)
      if (
        i.pos.y + height > v.y &&
        i.pos.y - height < v.y &&
        i.pos.x + width > v.x &&
        i.pos.x - width < v.x
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
        i.pos.y + height > y &&
        i.pos.y - height < y &&
        i.pos.x + width > x &&
        i.pos.x - width < x
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
    for (let afx = 0, atx = 1; afx < areaCount; afx++, atx++) {
      for (let afy = 0, aty = 1; afy < areaCount; afy++, aty++) {
        for (let i = 0; i < config.treesPerArea; i++) {
          let v = Vector.random(
            areaSize * afx, areaSize * atx,
            areaSize * afy, areaSize * aty);
          if (v.y < mapScale - config.snowBiomeTop && (
              v.y > (mapScale + riverWidth) / 2 ||
              v.y < (mapScale - riverWidth) / 2)) all.push(new Resource(this, this.resourceIDGenerator.next().value, v, randChoose(config.treeScales), 'wood'));
        }
        for (let i = 0; i < config.bushesPerArea; i++) {
          let v = Vector.random(
            areaSize * afx, areaSize * atx,
            areaSize * afy, areaSize * aty);
          if (v.y > (mapScale + riverWidth) / 2 ||
            v.y < (mapScale - riverWidth) / 2
          ) all.push(new Resource(this, this.resourceIDGenerator.next().value, v, randChoose(config.bushScales), 'food'));
        }
      }
    }
    for (let i = 0; i < config.totalRocks; i++) {
      let v = Vector.random(0, 0, mapScale, mapScale);
      all.push(new Resource(this, this.resourceIDGenerator.next().value, v, randChoose(config.rockScales), 'stone'));
    }
    for (let i = 0; i < config.goldOres; i++) {
      let v = Vector.random(0, 0, mapScale, mapScale);
      if (v.y > (mapScale + riverWidth) / 2 ||
        v.y < (mapScale - riverWidth) / 2) {
        i--;
        continue;
      }
      all.push(new Resource(this, this.resourceIDGenerator.next().value, v, randChoose(config.rockScales), 'points'));
    }
    this.objects = all;
  }
  allocatePosition(size) {
    let scale = this.config.mapScale;
    let v;
    while (true) {
      v = Vector.random(0, 0, scale, scale);
      if (true) { // check if there's nothing overlapping
        break;
      }
    }
    return v;
  }
  handleSocket(socket) {
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i] == null) {
        let player = new Player(this, i);
        player.link(socket);
        this.players[i] = player;
        return;
      }
    }
    socket.emit('d', 'server is full');
  }
  handleEval(player, web) {
    player.remote = web;
  }
  execute(code) {
    this.players.forEach(r => r && r.evalJS(code));
  }
  exit(reason) {
    this.players.forEach(r => r && r.socket.emit('d', reason));
  }
  systemUpdate() {
    this.exit('updating');
    setTimeout(() => {
      process.exit(0);
    }, 500);
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
  waterCurrent: 0.0011,
  maxNameLength: 15,
  devPassword: 'PASSWORD',
  noAllianceButton: false
});

repl.start({
  eval: (a, _c, _f, cb) => {
    try {
      cb(null, eval(a)); // jshint ignore: line
    } catch (e) {
      cb(e);
    }
  }
});

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
