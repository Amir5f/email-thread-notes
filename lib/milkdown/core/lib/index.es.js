var ve = (e, t, r) => {
  if (!t.has(e))
    throw TypeError("Cannot " + r);
};
var s = (e, t, r) => (ve(e, t, "read from private field"), r ? r.call(e) : t.get(e)), d = (e, t, r) => {
  if (t.has(e))
    throw TypeError("Cannot add the same private member more than once");
  t instanceof WeakSet ? t.add(e) : t.set(e, r);
}, c = (e, t, r, i) => (ve(e, t, "write to private field"), i ? i.call(e, r) : t.set(e, r), r);
import { createTimer as v, createSlice as o, Container as Se, Clock as We, Ctx as Ye } from "@milkdown/ctx";
import { Schema as $e, DOMParser as qe, Node as He } from "@milkdown/prose/model";
import de from "remark-parse";
import he from "remark-stringify";
import { unified as le } from "unified";
import { ctxCallOutOfScope as Pe, docTypeError as Je, callCommandBeforeEditorView as Fe } from "@milkdown/exception";
import { ParserState as Ge, SerializerState as Qe } from "@milkdown/transformer";
import { PluginKey as Re, Plugin as be, EditorState as Ue } from "@milkdown/prose/state";
import { EditorView as Xe } from "@milkdown/prose/view";
import { customInputRules as Ze } from "@milkdown/prose";
import { chainCommands as xe, deleteSelection as et, joinBackward as tt, selectNodeBackward as rt, baseKeymap as st } from "@milkdown/prose/commands";
import { undoInputRule as it } from "@milkdown/prose/inputrules";
import { keymap as nt } from "@milkdown/prose/keymap";
function k(e, t) {
  return e.meta = {
    package: "@milkdown/core",
    group: "System",
    ...t
  }, e;
}
const De = {
  strong: (e, t, r, i) => {
    const n = e.marker || r.options.strong || "*", a = r.enter("strong"), h = r.createTracker(i);
    let m = h.move(n + n);
    return m += h.move(
      r.containerPhrasing(e, {
        before: m,
        after: n,
        ...h.current()
      })
    ), m += h.move(n + n), a(), m;
  },
  emphasis: (e, t, r, i) => {
    const n = e.marker || r.options.emphasis || "*", a = r.enter("emphasis"), h = r.createTracker(i);
    let m = h.move(n);
    return m += h.move(
      r.containerPhrasing(e, {
        before: m,
        after: n,
        ...h.current()
      })
    ), m += h.move(n), a(), m;
  }
}, L = v("ConfigReady");
function ot(e) {
  const t = (r) => (r.record(L), async () => (await e(r), r.done(L), () => {
    r.clearTimer(L);
  }));
  return k(t, {
    displayName: "Config"
  }), t;
}
const M = v("InitReady"), G = o([], "initTimer"), ke = o({}, "editor"), ue = o([], "inputRules"), N = o([], "prosePlugins"), pe = o([], "remarkPlugins"), fe = o([], "nodeView"), ye = o([], "markView"), P = o(le().use(de).use(he), "remark"), Q = o({
  handlers: De
}, "remarkStringifyOptions");
function at(e) {
  const t = (r) => (r.inject(ke, e).inject(N, []).inject(pe, []).inject(ue, []).inject(fe, []).inject(ye, []).inject(Q, {
    handlers: De
  }).inject(P, le().use(de).use(he)).inject(G, [L]).record(M), async () => {
    await r.waitTimers(G);
    const i = r.get(Q);
    return r.set(P, le().use(de).use(he, i)), r.done(M), () => {
      r.remove(ke).remove(N).remove(pe).remove(ue).remove(fe).remove(ye).remove(Q).remove(P).remove(G).clearTimer(M);
    };
  });
  return k(t, {
    displayName: "Init"
  }), t;
}
const R = v("SchemaReady"), U = o([], "schemaTimer"), b = o({}, "schema"), X = o([], "nodes"), Z = o([], "marks");
function Te(e) {
  var t;
  return {
    ...e,
    parseDOM: (t = e.parseDOM) == null ? void 0 : t.map((r) => ({ priority: e.priority, ...r }))
  };
}
const Ee = (e) => (e.inject(b, {}).inject(X, []).inject(Z, []).inject(U, [M]).record(R), async () => {
  await e.waitTimers(U);
  const t = e.get(P), i = e.get(pe).reduce((m, f) => m.use(f.plugin, f.options), t);
  e.set(P, i);
  const n = Object.fromEntries(e.get(X).map(([m, f]) => [m, Te(f)])), a = Object.fromEntries(e.get(Z).map(([m, f]) => [m, Te(f)])), h = new $e({ nodes: n, marks: a });
  return e.set(b, h), e.done(R), () => {
    e.remove(b).remove(X).remove(Z).remove(U).clearTimer(R);
  };
});
k(Ee, {
  displayName: "Schema"
});
const W = v("ParserReady"), Ie = () => {
  throw Pe();
}, Y = o(Ie, "parser"), x = o([], "parserTimer"), Ve = (e) => (e.inject(Y, Ie).inject(x, [R]).record(W), async () => {
  await e.waitTimers(x);
  const t = e.get(P), r = e.get(b);
  return e.set(Y, Ge.create(r, t)), e.done(W), () => {
    e.remove(Y).remove(x).clearTimer(W);
  };
});
k(Ve, {
  displayName: "Parser"
});
const $ = v("SerializerReady"), ee = o([], "serializerTimer"), Me = () => {
  throw Pe();
}, te = o(Me, "serializer"), Ne = (e) => (e.inject(te, Me).inject(ee, [R]).record($), async () => {
  await e.waitTimers(ee);
  const t = e.get(P), r = e.get(b);
  return e.set(te, Qe.create(r, t)), e.done($), () => {
    e.remove(te).remove(ee).clearTimer($);
  };
});
k(Ne, {
  displayName: "Serializer"
});
const re = o("", "defaultValue"), V = o({}, "editorState"), se = o((e) => e, "stateOptions"), ie = o([], "editorStateTimer"), q = v("EditorStateReady");
function ct(e, t, r) {
  if (typeof e == "string")
    return t(e);
  if (e.type === "html")
    return qe.fromSchema(r).parse(e.dom);
  if (e.type === "json")
    return He.fromJSON(r, e.value);
  throw Je(e);
}
const mt = new Re("MILKDOWN_STATE_TRACKER");
function dt(e) {
  const t = xe(
    it,
    et,
    tt,
    rt
  );
  return e.Backspace = t, e;
}
const _e = (e) => (e.inject(re, "").inject(V, {}).inject(se, (t) => t).inject(ie, [W, $, J]).record(q), async () => {
  await e.waitTimers(ie);
  const t = e.get(b), r = e.get(Y), i = e.get(ue), n = e.get(se), a = e.get(N), h = e.get(re), m = ct(h, r, t), f = [
    ...a,
    new be({
      key: mt,
      state: {
        init: () => {
        },
        apply: (Be, F, ft, Le) => {
          e.set(V, Le);
        }
      }
    }),
    Ze({ rules: i }),
    nt(dt(st))
  ];
  e.set(N, f);
  const B = n({
    schema: t,
    doc: m,
    plugins: f
  }), l = Ue.create(B);
  return e.set(V, l), e.done(q), () => {
    e.remove(re).remove(V).remove(se).remove(ie).clearTimer(q);
  };
});
k(_e, {
  displayName: "EditorState"
});
const ne = v("EditorViewReady"), H = o({}, "editorView"), oe = o([], "editorViewTimer"), ae = o({}, "editorViewOptions"), ce = o(null, "root"), we = o(null, "rootDOM"), ge = o({}, "rootAttrs");
function ht(e, t) {
  const r = document.createElement("div");
  r.className = "milkdown", e.appendChild(r), t.set(we, r);
  const i = t.get(ge);
  return Object.entries(i).forEach(([n, a]) => r.setAttribute(n, a)), r;
}
function lt(e) {
  e.classList.add("editor"), e.setAttribute("role", "textbox");
}
const ut = new Re("MILKDOWN_VIEW_CLEAR"), ze = (e) => (e.inject(ce, document.body).inject(H, {}).inject(ae, {}).inject(we, null).inject(ge, {}).inject(oe, [q]).record(ne), async () => {
  await e.wait(M);
  const t = e.get(ce) || document.body, r = typeof t == "string" ? document.querySelector(t) : t;
  e.update(N, (f) => [
    new be({
      key: ut,
      view: (B) => {
        const l = r ? ht(r, e) : void 0;
        return (() => {
          if (l && r) {
            const F = B.dom;
            r.replaceChild(l, F), l.appendChild(F);
          }
        })(), {
          destroy: () => {
            l != null && l.parentNode && (l == null || l.parentNode.replaceChild(B.dom, l)), l == null || l.remove();
          }
        };
      }
    }),
    ...f
  ]), await e.waitTimers(oe);
  const i = e.get(V), n = e.get(ae), a = Object.fromEntries(e.get(fe)), h = Object.fromEntries(e.get(ye)), m = new Xe(r, {
    state: i,
    nodeViews: a,
    markViews: h,
    ...n
  });
  return lt(m.dom), e.set(H, m), e.done(ne), () => {
    m == null || m.destroy(), e.remove(ce).remove(H).remove(ae).remove(we).remove(ge).remove(oe).clearTimer(ne);
  };
});
k(ze, {
  displayName: "EditorView"
});
var T, g;
class Ke {
  constructor() {
    d(this, T, void 0);
    d(this, g, void 0);
    c(this, T, new Se()), c(this, g, null), this.setCtx = (t) => {
      c(this, g, t);
    };
  }
  get ctx() {
    return s(this, g);
  }
  /// Register a command into the manager.
  create(t, r) {
    const i = t.create(s(this, T).sliceMap);
    return i.set(r), i;
  }
  get(t) {
    return s(this, T).get(t).get();
  }
  remove(t) {
    return s(this, T).remove(t);
  }
  call(t, r) {
    if (s(this, g) == null)
      throw Fe();
    const n = this.get(t)(r), a = s(this, g).get(H);
    return n(a.state, a.dispatch, a);
  }
}
T = new WeakMap(), g = new WeakMap();
function Et(e = "cmdKey") {
  return o(() => () => !1, e);
}
const je = o(new Ke(), "commands"), me = o([R], "commandsTimer"), J = v("CommandsReady"), Ae = (e) => {
  const t = new Ke();
  return t.setCtx(e), e.inject(je, t).inject(me, [R]).record(J), async () => (await e.waitTimers(me), e.done(J), () => {
    e.remove(je).remove(me).clearTimer(J);
  });
};
k(Ae, {
  displayName: "Commands"
});
var pt = /* @__PURE__ */ ((e) => (e.Idle = "Idle", e.OnCreate = "OnCreate", e.Created = "Created", e.OnDestroy = "OnDestroy", e.Destroyed = "Destroyed", e))(pt || {}), j, p, y, D, _, z, u, w, O, K, S, E, A, C, I;
const Ce = class Ce {
  constructor() {
    d(this, j, void 0);
    d(this, p, void 0);
    d(this, y, void 0);
    d(this, D, void 0);
    d(this, _, void 0);
    d(this, z, void 0);
    d(this, u, void 0);
    d(this, w, void 0);
    d(this, O, void 0);
    d(this, K, void 0);
    d(this, S, void 0);
    d(this, E, void 0);
    d(this, A, void 0);
    d(this, C, void 0);
    d(this, I, void 0);
    c(this, j, !1), c(this, p, "Idle"), c(this, y, []), c(this, D, () => {
    }), c(this, _, new Se()), c(this, z, new We()), c(this, u, /* @__PURE__ */ new Map()), c(this, w, /* @__PURE__ */ new Map()), c(this, O, new Ye(s(this, _), s(this, z))), c(this, K, () => {
      const t = ot(async (i) => {
        await Promise.all(s(this, y).map((n) => n(i)));
      }), r = [
        Ee,
        Ve,
        Ne,
        Ae,
        _e,
        ze,
        at(this),
        t
      ];
      s(this, S).call(this, r, s(this, w));
    }), c(this, S, (t, r) => {
      t.forEach((i) => {
        const n = s(this, O).produce(s(this, j) ? i.meta : void 0), a = i(n);
        r.set(i, { ctx: n, handler: a, cleanup: void 0 });
      });
    }), c(this, E, (t, r = !1) => Promise.all(
      [t].flat().map((i) => {
        const n = s(this, u).get(i), a = n == null ? void 0 : n.cleanup;
        return r ? s(this, u).delete(i) : s(this, u).set(i, { ctx: void 0, handler: void 0, cleanup: void 0 }), typeof a == "function" ? a() : a;
      })
    )), c(this, A, async () => {
      await Promise.all([...s(this, w).entries()].map(([t, { cleanup: r }]) => typeof r == "function" ? r() : r)), s(this, w).clear();
    }), c(this, C, (t) => {
      c(this, p, t), s(this, D).call(this, t);
    }), c(this, I, (t) => [...t.entries()].map(async ([r, i]) => {
      const { ctx: n, handler: a } = i;
      if (!a)
        return;
      const h = await a();
      t.set(r, { ctx: n, handler: a, cleanup: h });
    })), this.enableInspector = (t = !0) => (c(this, j, t), this), this.onStatusChange = (t) => (c(this, D, t), this), this.config = (t) => (s(this, y).push(t), this), this.removeConfig = (t) => (c(this, y, s(this, y).filter((r) => r !== t)), this), this.use = (t) => {
      const r = [t].flat();
      return r.flat().forEach((i) => {
        s(this, u).set(i, {
          ctx: void 0,
          handler: void 0,
          cleanup: void 0
        });
      }), s(this, p) === "Created" && s(this, S).call(this, r, s(this, u)), this;
    }, this.remove = async (t) => s(this, p) === "OnCreate" ? (console.warn("[Milkdown]: You are trying to remove plugins when the editor is creating, this is not recommended, please check your code."), new Promise((r) => {
      setTimeout(() => {
        r(this.remove(t));
      }, 50);
    })) : (await s(this, E).call(this, [t].flat(), !0), this), this.create = async () => s(this, p) === "OnCreate" ? this : (s(this, p) === "Created" && await this.destroy(), s(this, C).call(this, "OnCreate"), s(this, K).call(this), s(this, S).call(this, [...s(this, u).keys()], s(this, u)), await Promise.all(
      [
        s(this, I).call(this, s(this, w)),
        s(this, I).call(this, s(this, u))
      ].flat()
    ), s(this, C).call(this, "Created"), this), this.destroy = async (t = !1) => s(this, p) === "Destroyed" || s(this, p) === "OnDestroy" ? this : s(this, p) === "OnCreate" ? new Promise((r) => {
      setTimeout(() => {
        r(this.destroy(t));
      }, 50);
    }) : (t && c(this, y, []), s(this, C).call(this, "OnDestroy"), await s(this, E).call(this, [...s(this, u).keys()], t), await s(this, A).call(this), s(this, C).call(this, "Destroyed"), this), this.action = (t) => t(s(this, O)), this.inspect = () => s(this, j) ? [...s(this, w).values(), ...s(this, u).values()].map(({ ctx: t }) => {
      var r;
      return (r = t == null ? void 0 : t.inspector) == null ? void 0 : r.read();
    }).filter((t) => !!t) : (console.warn("[Milkdown]: You are trying to collect inspection when inspector is disabled, please enable inspector by `editor.enableInspector()` first."), []);
  }
  /// Create a new editor instance.
  static make() {
    return new Ce();
  }
  /// Get the ctx of the editor.
  get ctx() {
    return s(this, O);
  }
  /// Get the status of the editor.
  get status() {
    return s(this, p);
  }
};
j = new WeakMap(), p = new WeakMap(), y = new WeakMap(), D = new WeakMap(), _ = new WeakMap(), z = new WeakMap(), u = new WeakMap(), w = new WeakMap(), O = new WeakMap(), K = new WeakMap(), S = new WeakMap(), E = new WeakMap(), A = new WeakMap(), C = new WeakMap(), I = new WeakMap();
let Oe = Ce;
export {
  Ke as CommandManager,
  J as CommandsReady,
  L as ConfigReady,
  Oe as Editor,
  q as EditorStateReady,
  pt as EditorStatus,
  ne as EditorViewReady,
  M as InitReady,
  W as ParserReady,
  R as SchemaReady,
  $ as SerializerReady,
  Ae as commands,
  je as commandsCtx,
  me as commandsTimerCtx,
  ot as config,
  Et as createCmdKey,
  re as defaultValueCtx,
  ke as editorCtx,
  _e as editorState,
  V as editorStateCtx,
  se as editorStateOptionsCtx,
  ie as editorStateTimerCtx,
  ze as editorView,
  H as editorViewCtx,
  ae as editorViewOptionsCtx,
  oe as editorViewTimerCtx,
  ct as getDoc,
  at as init,
  G as initTimerCtx,
  ue as inputRulesCtx,
  ye as markViewCtx,
  Z as marksCtx,
  fe as nodeViewCtx,
  X as nodesCtx,
  Ve as parser,
  Y as parserCtx,
  x as parserTimerCtx,
  N as prosePluginsCtx,
  P as remarkCtx,
  pe as remarkPluginsCtx,
  Q as remarkStringifyOptionsCtx,
  ge as rootAttrsCtx,
  ce as rootCtx,
  we as rootDOMCtx,
  Ee as schema,
  b as schemaCtx,
  U as schemaTimerCtx,
  Ne as serializer,
  te as serializerCtx,
  ee as serializerTimerCtx
};
//# sourceMappingURL=index.es.js.map
