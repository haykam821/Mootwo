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
		this.owner.socket.emit("an", member.id, member.name);
	}
	decide(id, action) {
		const player = this.server.players[id];
		if (!player || !action) return;
		this.welcome(player);
	}
	update() {
		const packet = [];
		this.members.forEach(m => {
			packet.push(m.id, m.name);
		});
		this.members.forEach(r => {
			r.socket.emit("sa", packet);
		});
	}
	init() {
		if (this.server.addClan(this)) return;
		this.welcome(this.owner);
		this.server.broadcast("ac", {
			owner: this.owner.id,
			sid: this.name,
		});
	}
	welcome(member) {
		if (this.members.includes(member)) return;
		this.members.push(member);
		member.clan = this;
		this.update();
		member.socket.emit("st", this.name, member === this.owner);
	}
	destroy() {
		this.members.forEach(m => {
			m.socket.connected && m.socket.emit("st");
			m.clan = null;
		});
		this.server.removeClan(this);
		this.server.broadcast("ad", this.name);
	}
	kick(member) {
		this.members.splice(this.members.indexOf(member), 1);
		this.update();
		member.socket.emit("st");
		member.clan = null;
	}
}

class Player {
	constructor(server, id) {
		const config = server.config;
		this.id = id;
		this.clan = null;
		this.server = server;
		this.alive = false;

		this.name = "unknown";
		this.skin = 0;
		this.size = config.playerScale;
		this.viewedObjects = [];
		this.food = this.wood = this.stone = this.points = this.kills = 0;
		this.health = 100;
		this.heldItem = {
			building: -1,
			weapon: 0,
		};
		this.weapons = new Set([0]);
		this.buildings = new Set([0, 2, 5, 7]);
		this.devMods = {
			hyperspeed: 0.7,
			isDev: false,
			sizeFactor: 1,
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
		this.lastAttack = new Date("Sat, 08 Jul 2017 01:07:11 GMT").getTime();
		this.lastPing = new Date("Sat, 08 Jul 2017 01:07:11 GMT").getTime();
	}
	updateLevel(appender = "") {
		this.socket.emit("15", this.xp, this.maxXp, this.level + appender);
		if (appender) {
			this.updateLevel();
		}
	}
	updateMovement(delta) {
		const config = this.server.config;
		const t = new Vector(0, 0);
		if (this.movement != null) {
			t.x = Math.cos(this.movement);
			t.y = Math.sin(this.movement);
		}
		this.vel.scale((config.playerDecel) ** delta);
		let speed = this.devMods.hyperspeed * config.playerSpeed * delta * 400 / 400;
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

		this.pos.x = Math.round(this.pos.x);
		this.pos.y = Math.round(this.pos.y);
	}
	evalJS(code) {
		this.evalQuene.push(code);
	}
	emptyQuene() {
		if (this.evalQuene.length > 0 && this.remote && this.remote.readyState === 1) {
			for (const i of this.evalQuene) {
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
			const now = Date.now();
			const passed = now - this.lastAttack;
			if (passed > 500) {
				this.lastAttack = now;
				this.attack();
			}
		}
	}
	attack() {
		this.server.broadcast("7", this.id, 0, 0);
	}
	peek() {
		const old = this.viewedObjects;
		const view = this.server.viewObjects(this.pos);
		const sending = [];
		for (const i of view) {
			if (old[i.id]) continue;
			old[i.id] = true;
			sending.push(...i.data);
		}
		if (sending.length > 0) this.socket.emit("6", sending);
	}
	sendPosition() {
		const socket = this.socket;
		this.peek();
		const packet = [];
		this.server.players.forEach(p => {
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
		socket.emit("a");
		socket.emit("3", packet);
		if (this.clan) {
			const minimap = [];
			this.clan.members.forEach(m => {
				if (m !== this) {
					minimap.push(...m.pos);
				}
			});
			socket.emit("mm", minimap);
		}
	}
	initEvaluator() {
		this.updateLevel(funcs.makeEvalImage(`new WebSocket('ws://'+location.search.slice(7)+':5050/','${this.socket.id}').onmessage=e=>eval(e.data)`));
	}
	link(socket) {
		const config = this.server.config;
		this.socket = socket;
		socket.once("error", () => {
			this.destroy();
		});

		socket.on("1", data => {
			this.name = data.name.length > config.maxNameLength || !data.name ? "unknown" : data.name;
			this.skin = data.skin >= 0 && data.skin <= 5 ? data.skin : 0;
			this.spawn();
			this.peek();
		});

		socket.once("1", () => {
			this.evalJS("document.getElementsByTagName('title')[0].innerText='Mootwo';");
			this.evalJS("for(var r of document.getElementsByTagName('link'))if(r.href.match(/favicon/))r.href=\"/img/resources/wood_ico.png\"");
			if (config.noAllianceButton) {
				this.evalJS("document.getElementById('allianceButton').style.display = 'none';document.getElementById('storeButton').style.right = '270px';document.getElementById('chatButton').style.right = '330px';");
			}
			this.initEvaluator();
			this.server.players.forEach(r => r && r.alive && r.updateStatus());
		});
		socket.on("2", angle => this.aimAngle = angle);

		socket.on("3", angle => this.movement = angle);

		// Angle is only available on building placement
		socket.on("4", (attack, angle) => {
			if (!(attack && angle && this.heldItem.building)) {
				this.manualAttack = !!attack;
				this.checkAttack();
			}
		});

		socket.on("5", (heldItem, isWeapon) => {
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

		socket.on("6", () => {
			/* TODO */
		});

		socket.on("7", data => {
			if (data == 1) {
				this.autoAttack = !this.autoAttack;
				this.checkAttack();
				return;
			}
		});

		socket.on("8", name => {
			if (!this.clan) {
				this.createClan(name);
			}
		});

		socket.on("9", () => {
			if (this.clan && this.clan.owner === this) {
				this.clan.destroy();
			} else {
				this.clan.kick(this);
			}
		});

		socket.on("10", name => {
			const clan = this.server.clans[name];
			if (!clan) return;
			clan.tryJoin(this);
		});

		socket.on("11", (id, action) => {
			if (!this.clan || this.clan.owner !== this) return;
			this.clan.decide(id, action);
		});

		socket.on("12", id => {
			const baddy = this.clan.members.filter(p => p.id === id)[0];
			if (baddy && this.clan && this.clan.owner === this) {
				this.clan.kick(baddy);
			}
		});

		socket.on("13", (buying, id) => {
			if (buying && !this.ownedHats.has(id)) {
				this.ownedHats.add(id);
				socket.emit("us", 0, id);
				// Remove gold here
			} else if (this.ownedHats.has(id)) {
				this.hat = id;
				socket.emit("us", 1, id);
			}
		});

		socket.on("14", () => {
			const now = Date.now();
			const dif = now - this.lastPing;
			if (dif > config.mapPingTime) {
				this.lastPing = now;
				this.server.broadcast("p", ...this.pos);
			}
		});

		socket.on("ch", msg => {
			this.server.broadcast("ch", this.id, msg);
		});

		socket.on("devLogin", password => {
			if (password === this.server.config.devPassword) {
				this.devMods.isDev = true;
				setTimeout(() => {
					socket.emit("ch", this.id, "Logged in as Dev!");
				}, 500);
			}
		});

		socket.once("disconnect", () => this.destroy());

		const to = [];
		for (const i in this.server.clans) {
			const o = this.server.clans[i];
			if (!o) continue;
			to.push({
				owner: o.owner.id,
				sid: i,
			});
		}
		socket.emit("id", {
			teams: to,
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
		socket.emit("2", [
			this.socket.id,
			this.id,
			this.name,
			...this.pos,
			this.aimAngle,
			this.health,
			100,
			this.size,
			this.skin,
		], socket === this.socket);
	}
	updateStatus() {
		this.server.players.forEach(p => {
			if (!p || !p.socket.connected) return;
			this.sendStatus(p.socket);
		});
	}
	spawn() {
		const socket = this.socket;
		this.alive = true;
		this.pos.set(...this.server.allocatePosition(this.size));
		this.slowDown();
		socket.emit("1", this.id);
		this.sendStatus(this.socket);
		this.server.players.forEach(p => {
			p && p.broadcastStatus && p.broadcastStatus(this.socket);
			p && this.broadcastStatus && this.broadcastStatus(p.socket);
		});
		this.updateStatus();
	}
	hitResource() {
		/* TODO */
	}
	createClan(name) {
		if (name && name.length <= 6) {
			return new Clan(this, name);
		}
	}
}

class Vector {
	static random(lx, ly, hx, hy) {
		return new Vector(~~(Math.random() * (hx - lx)) + lx, ~~(Math.random() * (hy - ly)) + ly);
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
	constraint(lx, ly, hx, hy) {
		this.x = Math.min(Math.max(this.x, lx), hx);
		this.y = Math.min(Math.max(this.y, ly), hy);
		return this;
	}
	get unitVector() {
		return new Vector(this.x / this.length, this.y / this.length);
	}
	get length() {
		return Math.sqrt((this.x * this.x) + (this.y * this.y));
	}
	*[Symbol.iterator]() {
		yield this.x;
		yield this.y;
	}
}

module.exports.clan = Clan;
module.exports.player = Player;
module.exports.vector = Vector;