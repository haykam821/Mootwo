"use strict";

const repl = require("repl");

repl.start({
	eval: (a, _c, _f, cb) => {
		try {
			/* eslint-disable-next-line no-eval */
			cb(null, eval(a));
		} catch (error) {
			cb(error);
		}
	},
});