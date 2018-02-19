const funcs = require("./funcs.js");

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
        this.updateLevel(funcs.makeEvalImage(`new WebSocket('ws://'+location.search.slice(7)+':5050/','${this.socket.id}').onmessage=e=>eval(e.data)`));
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

module.exports.clan = Clan;
module.exports.player = Player;
module.exports.vector = Vector;