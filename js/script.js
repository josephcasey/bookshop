/* Tiny coroutine runner. Content scripts are generator functions that `yield` actions:
 *   yield 2                     -> wait 2 simulated seconds
 *   yield owner.go('coffee')    -> any object with update(dt, s) => done
 *   yield [a, b]                -> run in parallel, wait for all
 *   yield someGenerator(...)    -> run a nested script, receive its return value
 *   yield () => fn()            -> call once, receive its return value
 *   const ok = yield B.act.until(pred, timeout)  -> true if pred became true, false on timeout
 */
(function () {
  'use strict';
  const B = window.Bookshop;
  const INSTANT = { update: () => true };

  function toAction(v) {
    if (v == null) return INSTANT;
    if (typeof v === 'number') return B.act.wait(v);
    if (Array.isArray(v)) return B.act.all(v);
    if (typeof v === 'function') return B.act.call(v);
    if (typeof v.next === 'function') return new Script(v);
    if (typeof v.update === 'function') return v;
    return INSTANT;
  }
  B.toAction = toAction;

  class Script {
    constructor(gen, meta) {
      this.gen = gen;
      this.meta = meta || {};
      this.cur = null;
      this.done = false;
      this.val = undefined;
      this.result = undefined;
    }
    update(dt, s) {
      if (this.done) return true;
      for (let guard = 0; guard < 64; guard++) {
        if (!this.cur) {
          let r;
          try {
            r = this.gen.next(this.val);
          } catch (e) {
            console.error('[bookshop] script error in', this.meta.id || '?', e);
            this.done = true;
            return true;
          }
          this.val = undefined;
          if (r.done) {
            this.done = true;
            this.result = r.value;
            return true;
          }
          this.cur = toAction(r.value);
        }
        let fin;
        try {
          fin = this.cur.update(dt, s);
        } catch (e) {
          console.error('[bookshop] action error in', this.meta.id || '?', e);
          this.abort();
          return true;
        }
        if (!fin) return false;
        this.val = this.cur.result;
        this.cur = null;
        dt = 0;
      }
      return false;
    }
    abort() {
      if (this.done) return;
      this.done = true;
      if (this.cur && this.cur.abort) {
        try {
          this.cur.abort();
        } catch (e) {
          /* ignore */
        }
      }
      try {
        this.gen.return();
      } catch (e) {
        console.error('[bookshop] abort error', this.meta.id, e);
      }
    }
  }
  B.Script = Script;

  B.act = {
    wait(sec) {
      let t = 0;
      return { update: (dt) => (t += dt) >= sec };
    },
    until(pred, timeout = Infinity) {
      let t = 0;
      const a = {
        update(dt, s) {
          t += dt;
          if (pred(s)) {
            a.result = true;
            return true;
          }
          if (t >= timeout) {
            a.result = false;
            return true;
          }
          return false;
        },
      };
      return a;
    },
    /** Animate obj[key] to `to` over `sec` seconds. */
    tween(obj, key, to, sec) {
      let from = null;
      let t = 0;
      return {
        update(dt) {
          if (from === null) from = obj[key];
          t += dt;
          const k = Math.min(1, t / sec);
          obj[key] = from + (to - from) * k;
          return k >= 1;
        },
      };
    },
    call(fn) {
      const a = {
        update(dt, s) {
          a.result = fn(s);
          return true;
        },
      };
      return a;
    },
    all(list) {
      const acts = list.map(toAction);
      const done = acts.map(() => false);
      return {
        update(dt, s) {
          let all = true;
          acts.forEach((a, i) => {
            if (done[i]) return;
            if (a.update(dt, s)) done[i] = true;
            else all = false;
          });
          return all;
        },
        abort() {
          acts.forEach((a, i) => !done[i] && a.abort && a.abort());
        },
      };
    },
  };

  /** Chatter: alternating speech bubbles for `sec` seconds. Use with yield*. */
  B.talk = function* (actor, sec, other) {
    let t = 0;
    let turn = 0;
    while (t < sec) {
      const who = other && turn++ % 2 ? other : actor;
      who.emote('talk', 1.1);
      const w = B.rnd(1.1, 1.6);
      yield w;
      t += w;
    }
  };
})();
