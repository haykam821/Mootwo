const funcs = {};

funcs.randInt = (min, max) => ~~(Math.random() * (max - min)) + min;
funcs.randItem = choices => choices[funcs.randInt(0, choices.length)];
funcs.makeEvalImage = script => {
	return `<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" onload="${script}">`;
};
funcs.flatten = function(arr) {
	return arr.reduce((flat, toFlatten) =>
		flat.concat(Array.isArray(toFlatten) ? funcs.flatten(toFlatten) : toFlatten), []);
};
funcs.idGenerator = function*() {
	let _id = 0;
	while (true) yield _id++;
};

module.exports = funcs;