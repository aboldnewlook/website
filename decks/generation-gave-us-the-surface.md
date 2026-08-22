---
title: Generation gave us the surface
summary: OpenTDF — three SDKs, a generated contract layer, and a conformance matrix that runs on every change.
fonts:
  - Space+Grotesk:wght@400;500;700
  - Source+Serif+4:opsz,wght@8..60,400;8..60,600
  - IBM+Plex+Mono:wght@400;500
---
```css theme
.deck {
  --card:  #132026;
  --ink:   #ECE7DC;
  --accent:#E3B23C;
  --serif: "Source Serif 4", Georgia, serif;
  --mono:  "IBM Plex Mono", ui-monospace, monospace;
}
.deck h2 {
  font-family: "Space Grotesk", system-ui, sans-serif;
  letter-spacing: -0.02em;
}
.deck-backdrop {
  background: radial-gradient(120% 90% at 50% 10%, #16252B, #0F1A1E 55%, #0B1316);
}
.deck-backdrop::before {
  background-image: url("/deck/pattern.svg?g=%C2%A7&size=54&opacity=0.05");
  --wallpaper-angle: -15deg;
  --wallpaper-drift: 120s;
}
```
<!-- pos: 0,0 -->
<!-- kicker: 00 — Opening -->
# Generation gave us the surface. The opinion was hand-written.

OpenTDF — three SDKs, a generated contract layer, and a conformance matrix that runs on every change.

Ryan Schumacher · Virtru

---
<!-- pos: 1,0 -->
<!-- kicker: 01 — Scope -->
# Two surfaces, orthogonal to each other

| | |
|---|---|
| **Platform services** | KAS, authorization, policy, core systems — audit, config, PEPs. Ordinary distributed-systems work. |
| **Data format** | TDF structures, crypto, multiple format versions, parity across three languages. Versioned, cryptographic, byte-for-byte. |

You can refactor a service. **You cannot refactor your way out of a compatibility mistake.**

---
<!-- pos: 1,1 -->
<!-- kicker: 01 — Scope -->
# Six engineers

- Started as **11+ microservices** with a C++ core wrapped per language
- Every language paid an interop tax **and still owed conformance on top**
- Consolidated into one modular monorepo with native SDKs per language
- Six engineers against all of it: services, three SDKs, the CLI, the format, the crypto

Something had to give. **What gave was the SDK layer.**

---
<!-- pos: 2,0 -->
<!-- kicker: 02 — What an SDK is -->
# An SDK is an abstraction over two things

> An API surface, and a workflow.

- A generated client is **typed transport**. The SDK is **the opinion** — the order of operations, the things it won't let you get wrong.
- Here the workflow *is* the value: token acquisition, resolving which KAS holds the key, binding policy to payload, wrap and unwrap.
- **Encryption failures are silent.** A hand-rolled integration produces a TDF that looks fine and either won't open later or protects nothing.
- The SDK exists so the wrong sequence **isn't reachable**.

---
<!-- pos: 2,1 -->
<!-- kicker: 02 — What an SDK is -->
# The SDK is where change gets absorbed

- Without one, your contract ends up **encoded as literals inside every customer application** — unversioned copies, scattered across environments you can't see
- A domain move is a reverse proxy. **Most change isn't routable.** The SDK is a second surface where versioning can actually be managed
- If you don't give them an SDK, competent developers build one anyway — **once per customer, in private, with no conformance suite behind it**
- Typed enums are the mechanism: values discoverable through the compiler rather than memorized

---
<!-- pos: 3,0 -->
<!-- kicker: 03 — Failure evidence -->
# Prose specs underdetermine behavior

- **Third parties** implemented our open spec and misinterpreted it — or it wasn't clear enough. Conformance failures between two independent readings.
- **Then internally, the same thing.** One SDK could create and decrypt everything. Another produced interoperable output but couldn't decrypt from one of the others.
- The permutation matrix — not any single SDK's test suite — **is the real unit of correctness.**

---
<!-- pos: 3,1 -->
<!-- kicker: 03 — Failure evidence -->
# Liberal in what it accepts. Strict in what it produces.

- An SDK, unlike a loose collection of libraries, **can absorb reality a spec can't**
- It can support out-of-spec third-party TDFs already in the wild
- Workarounds get quarantined in one place **while the spec itself stays clean**

---
<!-- pos: 4,0 -->
<!-- kicker: 04 — Conformance -->
# A CLI has no idioms to honor

- The tension: SDKs must be idiomatic, therefore non-uniform, **therefore hard to compare mechanically**
- argv in, bytes out, exit code. Each language gets a thin CLI with an identical shape.
- The conformance matrix becomes a matrix over **processes**, not language bindings
- The harness needs a shell — not knowledge of Java versus Go
- Every pair tested — encrypt in Java, decrypt in Go — across TDF versions, with **zero language-specific test code**

***

Java, Go, JavaScript. `otdfctl` is a real product CLI; the others are deliberately minimal shims. One product, two test harnesses sharing a shape.

---
<!-- pos: 4,1 -->
<!-- kicker: 04 — Conformance -->
# If three implementations agree with each other and disagree with the spec, the spec is the outlier

- The objection first: a shim tests the SDK **through its author's own interpretation**. A shared misreading could stay green.
- With two languages, drift is easy. With three or more, the likelihood drops sharply.
- Conformance stops being a regression gate and becomes **a continuous ambiguity detector on our own written standard**
- Two implementations give a disagreement with no tiebreaker. **Three give a majority signal.**

---
<!-- pos: 5,0 -->
<!-- kicker: 05 — Generation -->
# One definition, both sides, in lockstep

- **Why ConnectRPC over OpenAPI-first:** OpenAPI would have locked us to HTTP. Adding gRPC later means a second protocol shape and a second source of truth.
- Contracts encapsulated as protobuf — there is always an inspectable contract
- One definition yields an unimplemented server interface and a working client. **Drift between them isn't a discipline problem, it's a compile error.**
- Contract-driven development: align on contracts first; SDK developers **regenerate rather than hand-build surface**
- Per-language surface labor collapsed. `This is why three SDKs is survivable with six.`

---
<!-- pos: 5,1 -->
<!-- kicker: 05 — Generation -->
# On-prem is why it has to be mechanical

| | |
|---|---|
| **SaaS** | Deprecation is an observability problem. Watch traffic, find the last caller, sunset. |
| **On-prem** | No telemetry. No control over upgrade timing. Compatibility can't be managed operationally at all. |
| **So** | Enforce it at build time — breaking-change detection against a baseline. The only lever available when you can't see your users. |

---
<!-- pos: 6,0 -->
<!-- kicker: 06 — Restish -->
# The surface without the opinion

- Because our OpenAPI is generated from the protos, a `restish` user gets shell-native commands, auth profiles, pagination and completion with **zero generated client code**
- It loads OpenAPI at runtime: path params become positional args, optional params become flags, summaries become help text
- Stays current the moment the server ships. Same spec serves humans and, via the MCP plugin, agents.
- But it gives you the API surface generically and **by design has no opinion about workflow** — which is exactly why it complements `otdfctl` rather than replacing it

---
<!-- pos: 7,0 -->
<!-- kicker: 07 — Idioms -->
# Uniformity is a maintainer's convenience

> You are the only one who sees all three.

- Your customer sees exactly one SDK. Consistency with the others is **invisible** to them; inconsistency with their language is **glaring**.
- Idiomatic SDKs cost more to build
- They pay back in **support tickets not filed, time-to-first-deploy, and customers who come back**

---
<!-- pos: 7,1 -->
<!-- kicker: 07 — Idioms -->
# Same semantics, three right answers

TDF config is deep and open-ended: attributes, assertions, obligations. Identical meaning in every language.

| | |
|---|---|
| **JavaScript** | Composition is native. Build the object up, pass it at the call site. A builder would be foreign here. |
| **Go** | Variadic options are established. `With…` functions extend the call before it or inside it. The developer chooses. |
| **Java** | Verbose by nature, wants a builder. That's what Java developers expect — and that expectation is legitimate. |

---
<!-- pos: 7,2 -->
<!-- kicker: 07 — Idioms -->
# The same encrypt: JavaScript

Composition is native. Build the object up, pass it at the call site.

```ts
const client = new OpenTDF({
  interceptors: [authTokenInterceptor(getToken)],
  platformUrl,
});

const cipherText = await client.createTDF({
  source: { type: 'stream', location: plainText },
});
```

---
<!-- pos: 7,3 -->
<!-- kicker: 07 — Idioms -->
# The same encrypt: Go

Variadic options extend the call before it or inside it. The developer chooses.

```go
s, err := sdk.New(platformEndpoint,
  sdk.WithClientCredentials(id, secret, scopes),
)

s.CreateTDF(&ciphertext, plaintext,
  sdk.WithDataAttributes(attr),
)
```

---
<!-- pos: 7,4 -->
<!-- kicker: 07 — Idioms -->
# The same encrypt: Java

Verbose by nature, wants a builder. That expectation is legitimate.

```java
SDK sdk = new SDKBuilder()
    .platformEndpoint(endpoint)
    .clientSecret(id, secret)
    .build();

var cfg = Config.newTDFConfig(
    Config.withDataAttributes(attr));
sdk.createTDF(in, out, cfg);
```

---
<!-- pos: 8,0 -->
<!-- kicker: 08a — AI · product -->
# The SDK is the guardrail for AI-written integration code

- **Strong:** producing plausible integration code fast, filling typed parameters, working from a contract in front of it
- **Weak:** knowing which of four plausible sequences is correct. More context doesn't fix it — **the correct sequence isn't written anywhere in the API surface.** It lives in the workflow opinion.
- Without an SDK you're asking a model to reconstruct your protocol from endpoints. With one, its job shrinks to **filling typed parameters** — the part it's reliably good at.
- Every constraint pushed into the type system is a check at build time instead of a bug that ships

---
<!-- pos: 8,1 -->
<!-- kicker: 08a — AI · product -->
# Compilation is a faster feedback loop than a request

- A type checker reports **every** wrong argument at once. An endpoint rejects on the first thing it hits, so the agent iterates serially — one request and one context window per attempt
- **An SDK gives errors before side effects.** A failed call may already have created something, consumed a token, or half-written state. Compile errors are free to be wrong.
- Docstrings and types are context the model gets **without paying to discover it**
- Verbose server errors cost bandwidth and network-layer resources in environments where customers pay for both

---
<!-- pos: 8,2 -->
<!-- kicker: 08a — AI · product -->
# Seven years of architecture, none of it timestamped

- OpenTDF has been public since **2019**. Model weights don't encode which data is fresher.
- A model has seen the 11-microservice era, the C++ core, and the current monorepo — with **no way to know those are a sequence rather than alternatives**
- It generates confidently against a shape we deprecated years ago, and the output looks plausible **because it was correct once**
- A made-up field name looks wrong to a reviewer. **Deprecated-but-real API surface looks fine to everyone who wasn't there in 2019.**
- Generated artifacts are the only trustworthy source *precisely because they're regenerated rather than recalled*

---
<!-- pos: 8,3 -->
<!-- kicker: 08c — AI · process -->
# Using AI to build the SDKs

- **The tension, stated first:** I just argued AI hallucinates against our API. Now we're using it to build the thing.
- Resolution is **blast radius and access**: the risk concentrates on one small team that owns the spec and can point the model at the actual repo — not distributed across every customer working from memory
- **Upstream monitoring:** six engineers built OpenTDF; Virtru has sixty, and the platform now underpins the whole product. AI watching proto diffs stages the downstream SDK work.
- **Docs as executable spec:** run a model against the quick start and help text and treat the documentation as the test case. BDD with markdown instead of Cucumber feature files, an agent instead of step definitions.
- Two-way check: if the agent can't follow the docs to a working integration, **either the docs lie or the SDK regressed**

---
<!-- pos: 9,0 -->
<!-- kicker: 09 — Close -->
# We can't see into the environment. So every guarantee has to be mechanical.

| | |
|---|---|
| **No telemetry** | Compile-time checks instead of runtime observation. |
| **No upgrade control** | Breaking-change detection against a baseline. |
| **No visibility into their models** | A typed SDK carrying the installed version's shape. |
