const util = require('util');

console.log(util);

class Hook {
  constructor(args = []) {
    this._args = args;
    this.taps = [];
    this.interceptors = [];
    this.call = this._call;
    this.promise = this._promise;
    this.callAsync = this._callAsync;
    this._x = undefined;
  }

  compile(options) {
    throw new Error("Abstract: should be overriden");
  }

  _createCall(type) {
    return this.compile({
      taps: this.taps,
      interceptors: this.interceptors,
      args: this._args,
      type: type,
    });
  }

  _tap(type, options, fn) {
    if (typeof options === 'string') {
      options = {
        name: options
      };
    } else if (
      typeof options !== 'object' ||
      options === null
    ) {
      throw new Error('Invalid tap options');
    }
    if (
      typeof options.name !== 'string' ||
      options.name === '' 
    ) {
      throw new Error('Missing name for tap');
    }
    options = Object.assign({type, fn}, options);
    options = this._runRegisterInterceptors(options);
    this._insert(options);
  }

  tap(options, fn) {
    this._tap('sync', options, fn);
  }

  tapAsync(options, fn) {
    this._tap('async', options, fn);
  }

  tapPromise(options, fn) {
    this._tap('promise', options, fn);
  }

  _runRegisterInterceptors(options) {
    for (const interceptor of this.interceptors) {
      if (interceptor.register) {
        const newOptions = interceptor.register(options);
        if (newOptions !== undefined) {
          options = newOptions;
        }
      }
    }
    return options;
  }

  withOptions(options) {
    const mergeOptions = opt =>
      Object.assign({}, options, typeof opt === 'string'? {name: opt}: opt);
    
    // prevent creating endless prototype chains
    options = Object.assign({}, options, this._withOptions);
		const base = this._withOptionsBase || this;
		const newHook = Object.create(base);

		newHook.tap = (opt, fn) => base.tap(mergeOptions(opt), fn);
		newHook.tapAsync = (opt, fn) => base.tapAsync(mergeOptions(opt), fn);
		newHook.tapPromise = (opt, fn) => base.tapPromise(mergeOptions(opt), fn);
		newHook._withOptions = options;
		newHook._withOptionsBase = base;
		return newHook;
  }

  isUsed() {
    return this.taps.length > 0 || this.interceptors.length > 0;
  }

  intercept(interceptor) {
    this._resetCompilation();
    this.interceptors.push(Object.assign({}, interceptor));
    if (interceptor.register) {
      for (let i = 0; i < this.taps.length; i++) {
        this.taps[i] = interceptor.register(this.taps[i]);
      }
    }
  }

  _resetCompilation() {
    this.call = this._call;
    this.callAsync = this._callAsync;
    this.promise = this._promise;
  }

  _insert(item) {
		this._resetCompilation();
		let before;
		if (typeof item.before === "string") {
			before = new Set([item.before]);
		} else if (Array.isArray(item.before)) {
			before = new Set(item.before);
		}
		let stage = 0;
		if (typeof item.stage === "number") {
			stage = item.stage;
		}
		let i = this.taps.length;
		while (i > 0) {
			i--;
			const x = this.taps[i];
			this.taps[i + 1] = x;
			const xStage = x.stage || 0;
			if (before) {
				if (before.has(x.name)) {
					before.delete(x.name);
					continue;
				}
				if (before.size > 0) {
					continue;
				}
			}
			if (xStage > stage) {
				continue;
			}
			i++;
			break;
		}
		this.taps[i] = item;
	}


}



function createCompileDelegate(name, type) {
	return function lazyCompileHook(...args) {
		this[name] = this._createCall(type);
		return this[name](...args);
	};
}

Object.defineProperties(Hook.prototype, {
	_call: {
		value: createCompileDelegate("call", "sync"),
		configurable: true,
		writable: true
	},
	_callAsync: {
		value: createCompileDelegate("callAsync", "async"),
		configurable: true,
		writable: true
	},
	_promise: {
		value: createCompileDelegate("promise", "promise"),
		configurable: true,
		writable: true
	}
});

module.exports = Hook;