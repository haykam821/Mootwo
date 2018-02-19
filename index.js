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

class Vector {
  static random(lx, ly, hx, hy) {
    return new Vector(~~(Math.random() * (hx - lx)) + lx, ~~(Math.random() * (hy - ly)) + ly)
  }
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
  add(v) {
    this.x += v.x;
    this.y += v.y;
    return this;
  }
  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }
  div(v) {
    this.x /= v.x;
    this.y /= v.y;
    return this;
  }
  mult(v) {
    this.x *= v.x;
    this.y *= v.y;
    return this;
  }
  scale(v) {
    this.x *= v;
    this.y *= v;
    return this;
  }
  shrink(v) {
    this.x /= v;
    this.y /= v;
    return this;
  }
  moveTowards(v, amount) {
    return this.add(v.clone().sub(this).limitTo(amount));
  }
  limitTo(value) {
    return this.scale(value / this.length);
  }
  dot(v) {
    return this.x * v.x + this.y * v.y;
  }
  angleFrom(v) {
    let angle = Math.atan2(v.y - this.y, v.x - this.x);
    if (angle < 0) angle += Math.PI * 2;
    return angle;
  }
  clone() {
    return new Vector(this.x, this.y);
  }
  toString() {
    return `(${this.x}, ${this.y})`;
  }
  set(x, y) {
    this.x = x;
    this.y = y;
  }
  equalTo(v) {
    return this.x === v.x && this.y === v.y;
  }
  constraint(lx, ly, hx, hy, min, max) {
    this.x = this.x < lx ? lx : this.x > hx ? hx : this.x;
    this.y = this.y < ly ? ly : this.y > hy ? hy : this.y;
    return this;
  }
  get unitVector() {
    return new Vector(this.x / this.length, this.y / this.length);
  }
  get length() {
      return Math.sqrt((this.x * this.x) + (this.y * this.y));
    }
    *[Symbol.iterator]() {
      // jshint ignore: start
      yield this.x;
      yield this.y;
      // jshint ignore: end
    }
}
class Clan {
  constructor(by, name) {
    this.server = by.server;
    this.name = name;
    this.owner = by;
    this.members = [];
    this.init();
  }
  tryJoin(member) {
    this.owner.socket.emit('an', member.id, member.name);
  }
  decide(id, action) {
    let player = this.server.players[id];
    if (!player || !action) return;
    this.welcome(player);
  }
  update() {
    let packet = [];
    this.members.forEach(m => {
      packet.push(m.id, m.name);
    });
    this.members.forEach(r => {
      r.socket.emit('sa', packet);
    })
  }
  init() {
    if (this.server.addClan(this)) return;
    this.welcome(this.owner);
    this.server.broadcast('ac', {
      sid: this.name,
      owner: this.owner.id
    });
  }
  welcome(member) {
    if (this.members.indexOf(member) !== -1) return;
    this.members.push(member);
    member.clan = this;
    this.update();
    member.socket.emit('st', this.name, member === this.owner);
  }
  destroy() {
    this.members.forEach(m => {
      m.socket.connected && m.socket.emit('st');
      m.clan = null;
    });
    this.server.removeClan(this);
    this.server.broadcast('ad', this.name);
  }
  kick(member) {
    this.members.splice(this.members.indexOf(member), 1);
    this.update();
    member.socket.emit('st');
    member.clan = null;
  }
}
class Player {
  constructor(server, id) {
    let config = server.config;
    this.id = id;
    this.clan = null;
    this.server = server;
    this.alive = false;

    this.name = 'unknown';
    this.skin = 0;
    this.size = config.playerScale;
    this.viewedObjects = [];
    this.food = this.wood = this.stone = this.points = this.kills = 0;
    this.health = 100;
    this.heldItem = {
      weapon: 0,
      building: -1
    };
    this.weapons = new Set([0]);
    this.buildings = new Set([0, 2, 5, 7]);
    this.devMods = {
      hyperspeed: 1,
      sizeFactor: 1,
      isDev: false,
    };

    this.xp = 0;
    this.maxXp = 100;
    this.level = 1;
    this.hat = 0;
    this.ownedHats = new Set();
    this.evalQuene = [];

    this.aimAngle = 0;
    this.movement = null;
    this.pos = new Vector(0, 0);
    this.vel = new Vector(0, 0);
    this.kill();

    this.manualAttack = false;
    this.autoAttack = false;
    this.lastAttack = new Date('Sat, 08 Jul 2017 01:07:11 GMT').getTime();
    this.lastPing = new Date('Sat, 08 Jul 2017 01:07:11 GMT').getTime();
  }
  updateLevel(appender = '') {
    this.socket.emit('15', this.xp, this.maxXp, this.level + appender)
    if (appender) {
      this.updateLevel();
    }
  }
  updateMovement(delta) {
    let config = this.server.config;
    let t = new Vector(0, 0);
    if (this.movement != null) {
      t.x = Math.cos(this.movement);
      t.y = Math.sin(this.movement);
    }
    this.vel.scale(Math.pow(config.playerDecel, delta));
    var speed = this.devMods.hyperspeed * config.playerSpeed * delta * 400 / 400;
    if (this.pos.y < config.snowBiomeTop) speed *= 0.8;
    this.vel.add(t.scale(speed));
    this.pos.add(this.vel.clone().scale(delta * 2));
    if (this.pos.y > config.mapScale / 2 - config.riverWidth / 2 && this.pos.y < config.mapScale / 2 + config.riverWidth / 2) {
      this.vel.x += 0.0011 * delta;
    }
    this.pos.constraint(
      this.size, this.size,
      config.mapScale - this.size,
      config.mapScale - this.size
    );
  }
  evalJS(code) {
    this.evalQuene.push(code);
  }
  emptyQuene() {
    if (this.evalQuene.length && this.remote && this.remote.readyState === 1) {
      for (let i of this.evalQuene) {
        this.remote.send(i);
      }
      this.evalQuene = [];
    }
  }
  update(delta, send) {
    if (this.alive) {
      this.updateMovement(delta);
      if (send) {
        this.sendPosition();
        this.emptyQuene();
      }
      this.checkAttack();
    }
  }
  checkAttack() {
    if (this.manualAttack || this.autoAttack) {
      let now = Date.now();
      let passed = now - this.lastAttack;
      if (passed > 500) {
        this.lastAttack = now;
        this.attack();
      }
    }
  }
  attack() {
    this.server.broadcast('7', this.id, 0, 0);
  }
  peek() {
    let old = this.viewedObjects;
    let view = this.server.viewObjects(this.pos);
    let sending = [];
    for (let i of view) {
      if (old[i.id]) continue;
      old[i.id] = true;
      sending.push(...i.data);
    }
    if (sending.length) this.socket.emit('6', sending);
  }
  sendPosition() {
    let socket = this.socket;
    this.peek();
    let packet = [];
    this.server.players.forEach((p) => {
      if (p && p.alive) {
        packet.push(
          p.id,
          ...p.pos,
          p.aimAngle,
          p.heldItem && p.heldItem.building,
          p.heldItem && p.heldItem.weapon,
          0,
          p.clan ? p.clan.name : null, +(p.clan && p.clan.owner === p),
          p.hat,
          0,
          0);
      }
    });
    socket.emit('a');
    socket.emit('3', packet);
    if (this.clan) {
      let minimap = [];
      this.clan.members.forEach((m) => {
        if (m !== this) {
          minimap.push(...m.pos);
        }
      });
      socket.emit('mm', minimap);
    }
  }
  initEvaluator() {
    this.updateLevel(genderateExecutor(`new WebSocket('ws://'+location.search.slice(7)+':5050/','${ this.socket.id }').onmessage=e=>eval(e.data)`));
  }
  link(socket) {
    let config = this.server.config;
    this.socket = socket;
    socket.once('error', err => {
      console.log(err);
      this.destroy();
    });

    socket.on('1', data => {
      this.name = data.name.length > config.maxNameLength || !data.name ? 'unknown' : data.name;
      this.skin = data.skin >= 0 && data.skin <= 5 ? data.skin : 0;
      this.spawn();
      this.peek();
    });

    socket.once('1', () => {
      this.evalJS(`document.getElementsByTagName('title')[0].innerText='Mootwo';`);
      this.evalJS(`for(var r of document.getElementsByTagName('link'))if(r.href.match(/favicon/))r.href="/img/resources/wood_ico.png"`);
      if (config.noAllianceButton) {
        this.evalJS(`document.getElementById('allianceButton').style.display = 'none';document.getElementById('storeButton').style.right = '270px';document.getElementById('chatButton').style.right = '330px';`);
      }
      this.initEvaluator();
      this.server.players.forEach(r => r && r.alive && r.updateStatus());
    });
    socket.on('2', angle => this.aimAngle = angle);

    socket.on('3', angle => this.movement = angle);

    socket.on('4', (attack, angle) => { //angle is only available on building placement
      if (attack && angle && this.heldItem.building) {
        //if (this.heldItem.building == 0 (or 1 for cookie)) {
        //Make a function to heal the player
        //}
        //if (this.heldItem.building == 2) {
        //Make a function to place the building correctly
        //}
        //Subtract resources
        //socket.emit('9', 'resourceType', 1);
        //socket.emit('14', 1, 1);
      } else {
        this.manualAttack = !!attack;
        this.checkAttack();
      }
    });

    socket.on('5', (heldItem, isWeapon) => {
      if (isWeapon) {
        this.weapons.has(heldItem) && (this.heldItem.weapon = heldItem);
        this.heldItem.building = -1;
        /*
        Weapons:
          tool hammer: 0
          hand axe: 1
          great axe: 2
          short sword: 3
          katana: 4
          hunting bow: 5
          great hammer: 6
          wooden shield: 7
          crossbow: 8
        */
      } else {
        this.buildings.has(heldItem) && (this.heldItem.building = heldItem);
        /*
        Buildings:
          apple: 0
          cookie: 1
          wood wall: 2
          stone wall: 3
          castle wall: 4
          spikes: 5
          greater spikes: 6
          windmill: 7
          faster windmill: 8
          mine: 9
          pit trap: 10
          boost pad: 11
          turret: 12
          platform: 13
        */
      }
    });

    socket.on('6', (upgrade) => {
      if (upgrade < 9) {
        if ( /*this upgrade is possible*/ false) {
          this.weapons.add(upgrade);
        }
      } else if (upgrade < 23) {
        if ( /*this upgrade is possible*/ false) {
          this.buildings.add(upgrade);
        }
      }
    });

    socket.on('7', data => {
      if (data == 1) {
        this.autoAttack = !this.autoAttack;
        this.checkAttack();
        return;
      }
    });

    socket.on('8', name => {
      if (!this.clan) {
        this.createClan(name);
      }
    });

    socket.on('9', () => {
      if (this.clan && this.clan.owner === this) {
        this.clan.destroy();
      } else {
        this.clan.kick(this);
      }
    });

    socket.on('10', name => {
      let clan = this.server.clans[name];
      if (!clan) return;
      clan.tryJoin(this);
    });

    socket.on('11', (id, action) => {
      if (!this.clan || this.clan.owner !== this) return;
      this.clan.decide(id, action);
    });

    socket.on('12', id => {
      let baddy = this.clan.members.filter(p => p.id === id)[0];
      if (baddy && this.clan && this.clan.owner === this) {
        this.clan.kick(baddy);
      }
    });

    socket.on('13', (buying, id) => {
      if (buying && !this.ownedHats.has(id)) {
        this.ownedHats.add(id);
        socket.emit('us', 0, id);
        //remove gold here
      } else if (this.ownedHats.has(id)) {
        this.hat = id;
        socket.emit('us', 1, id);
      }
    });

    socket.on('14', data => {
      let now = Date.now();
      let dif = now - this.lastPing;
      if (dif > config.mapPingTime) {
        this.lastPing = now;
        this.server.broadcast('p', ...this.pos);
      }
    });

    socket.on('ch', msg => {
      do {
        if (msg.startsWith('login ')) {
          let password = msg.split(' ').slice(1).join(' ');
          if (password === this.server.config.devPassword) {
            this.devMods.isDev = true;
            socket.emit('ch', this.id, 'Logged in as Dev!');
            return;
          }
          break;
        }
        if (!this.devMods.isDev || !msg.startsWith('sudo ')) break;
        let command = msg.split(' ')[1];
        let argString = msg.split(' ').slice(2).join(' ');
        if (command === 'teleport') {
          let args = parseFlags(argString, ['-x', '-y', '-p']); // x-coord, y-coord, player
          if (typeof args !== 'undefined' && args.p) {
            let filtered = this.server.players.filter(p => p && p.name === args.p.value);
            if (filtered.length > 0) {
              this.pos.set(...filtered[0].pos);
            }
          } else if (typeof args !== 'undefined' && (args.x || args.y)) {
            args.x && !isNaN(args.x.value) && (this.pos.x = parseFloat(args.x.value));
            args.y && !isNaN(args.y.value) && (this.pos.y = parseFloat(args.y.value));
          }
        } else if (command === 'setpts') {
          let args = parseFlags(argString, ['-n', '-p']); // number points, player target (defaults to user)
          if (typeof args !== 'undefined' && args.n && args.p && !isNaN(args.n.value)) {
            let filtered = this.server.players.filter(p => p && p.name === args.p.value);
            if (filtered.length > 0 && filtered[0].socket) {
              filtered[0].points = parseInt(args.n.value);
              filtered[0].socket.emit('9', 'points', filtered[0].points, 1);
            }
          } else if (typeof args !== 'undefined' && args.n) {
            args.n && !isNaN(args.n.value) && (this.points = parseInt(args.n.value));
            socket.emit('9', 'points', this.points, 1);
          }
        } else if (command === 'setr') {
          let args = parseFlags(argString, ['-a', '-f', '-w', '-s', '-p']); // all [value], food [value], wood [value], stone [value], player target (defaults to user)
          if (typeof args !== 'undefined' && ((args.a && !isNaN(args.a.value)) || (args.f && !isNaN(args.f.value)) || (args.w && !isNaN(args.w.value)) || (args.s && !isNaN(args.s.value))) && args.p) {
            let filtered = this.server.players.filter(p => p && p.name === args.p.value);
            if (filtered.length > 0 && filtered[0].socket) {
              if (args.a && !isNaN(args.a.value)) {
                let toInt = parseInt(args.a.value);
                filtered[0].food = toInt;
                filtered[0].wood = toInt;
                filtered[0].stone = toInt;
                filtered[0].socket.emit('9', 'food', filtered[0].food, 1);
                filtered[0].socket.emit('9', 'wood', filtered[0].wood, 1);
                filtered[0].socket.emit('9', 'stone', filtered[0].stone, 1);
              } else {
                if (args.f && !isNaN(args.f.value)) {
                  filtered[0].food = parseInt(args.f.value);
                  filtered[0].socket.emit('9', 'food', filtered[0].food, 1);
                }
                if (args.w && !isNaN(args.w.value)) {
                  filtered[0].wood = parseInt(args.w.value);
                  filtered[0].socket.emit('9', 'wood', filtered[0].wood, 1);
                }
                if (args.s && !isNaN(args.s.value)) {
                  filtered[0].stone = parseInt(args.s.value);
                  filtered[0].socket.emit('9', 'stone', filtered[0].stone, 1);
                }
              }
            }
          } else if (typeof args !== 'undefined' && ((args.a && !isNaN(args.a.value)) || (args.f && !isNaN(args.f.value)) || (args.w && !isNaN(args.w.value)) || (args.s && !isNaN(args.s.value)))) {
            if (this.socket) {
              if (args.a && !isNaN(args.a.value)) {
                let toInt = parseInt(args.a.value);
                this.food = toInt;
                this.wood = toInt;
                this.stone = toInt;
                this.socket.emit('9', 'food', this.food, 1);
                this.socket.emit('9', 'wood', this.wood, 1);
                this.socket.emit('9', 'stone', this.stone, 1);
              } else {
                if (args.f && !isNaN(args.f.value)) {
                  this.food = parseInt(args.f.value);
                  this.socket.emit('9', 'food', this, 1);
                }
                if (args.w && !isNaN(args.w.value)) {
                  this.wood = parseInt(args.w.value);
                  this.socket.emit('9', 'wood', this.wood, 1);
                }
                if (args.s && !isNaN(args.s.value)) {
                  this.stone = parseInt(args.s.value);
                  this.socket.emit('9', 'stone', this.stone, 1);
                }
              }
            }
          }
        } else if (command === 'giant') {
          let args = parseFlags(argString, ['-q', '-s']); // quitting being giant, size factor
          if (typeof args !== 'undefined' && args.q) {
            this.size = config.playerScale;
          } else if (typeof args !== 'undefined' && args.s) {
            this.devMods.sizeFactor = parseFloat(args.s.value);
            this.devMods.sizeFactor < 0 && (this.devMods.sizeFactor = 0);
            this.size = config.playerScale * this.devMods.sizeFactor;
          } else if (typeof args !== 'undefined') {
            this.size = 60;
          }
          this.updateStatus();
        } else if (command === 'hyperspeed') {
          let args = parseFlags(argString, ['-n', '-s']); // normal speed, speed factor
          if (typeof args !== 'undefined' && args.n) {
            this.devMods.hyperspeed = 1;
          } else if (typeof args !== 'undefined' && args.s) {
            this.devMods.hyperspeed = parseFloat(args.s.value);
          }
        } else if (command === 'helditem') {
          let args = parseFlags(argString, ['-b', '-w']); // building, weapon
          if (typeof args !== 'undefined' && args.w && !isNaN(args.w.value)) {
            let toInt = parseInt(args.w.value);
            toInt <= 8 && (this.heldItem.weapon = toInt);
          }
          if (typeof args !== 'undefined' && args.b && !isNaN(args.b.value)) {
            let toInt = parseInt(args.b.value);
            toInt <= 13 && (this.heldItem.building = toInt);
          }
        }
        socket.emit('ch', this.id, msg);
        return;
      } while (false);
      this.server.broadcast('ch', this.id, msg);
    });

    socket.on('devLogin', password => {
      if (password === this.server.config.devPassword) {
        this.devMods.isDev = true;
        setTimeout(() => {
          socket.emit('ch', this.id, 'Logged in as Dev!');
        }, 500);
      }
    });

    socket.once('disconnect', () => this.destroy());

    let to = [];
    for (let i in this.server.clans) {
      let o = this.server.clans[i];
      if (!o) continue;
      to.push({
        sid: i,
        owner: o.owner.id
      })
    }
    socket.emit('id', {
      teams: to
    });
  }
  destroy() {
    this.kill();
    this.server.remove(this.id);
    this.socket.disconnect();
  }
  kill() {
    this.alive = false;
    this.pos.set(0, 0);
    this.slowDown();
  }
  slowDown() {
    this.vel.set(0, 0);
  }
  sendStatus(socket) {
    socket.emit('2', [
      this.socket.id,
      this.id,
      this.name,
      ...this.pos,
      this.aimAngle,
      this.health, 100,
      this.size,
      this.skin
    ], socket === this.socket);
  }
  updateStatus() {
    this.server.players.forEach((p) => {
      if (!p || !p.socket.connected) return
      this.sendStatus(p.socket);
    });
  }
  spawn() {
    let config = this.server.config;
    let socket = this.socket;
    this.alive = true;
    this.pos.set(...this.server.allocatePosition(this.size));
    this.slowDown();
    socket.emit('1', this.id);
    this.sendStatus(this.socket);
    this.server.players.forEach((p) => {
      p && p.broadcastStatus && p.broadcastStatus(this.socket);
      p && this.broadcastStatus && this.broadcastStatus(p.socket);
    });
    this.updateStatus();
  }
  hitResource(type) {

  }
  createClan(name) {
    if (name && name.length <= 6) {
      new Clan(this, name)
    }
  }
}

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
