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
```talk
P1  Architecture of one SDK/codegen system you own
P2  Where language idioms did not map cleanly onto the shared spec
P3  Where AI fits in that pipeline

O1   [P1]     What OpenTDF is - policy travels with the data
O2   [P1]     Surface area: core platform, 5 services, 1 spec, 3 SDKs
O3   [P1]     Six or seven engineers against all of it
O4   [P1]     Air-gapped customers and third-hand information
O5   [P1]     Thesis: API surface plus workflow; generated client is typed transport, SDK is the opinion
O6   [P1]     Encryption failures are silent, so the wrong sequence must be unreachable
O7   [P1]     Without an SDK, customers hardcode strings and build their own wrapper anyway
O8   [P1]     Contract-based development via proto
O9   [P1]     Generate via ConnectRPC - HTTP and gRPC from one definition
O10  [P1]     Backward compatibility enforced mechanically - Buf breaking-change detection fails the build
O11  [P1]     On-prem means no telemetry and no upgrade control, so it must be enforced at build time
O12  [P1]     Platform powered by the SDK, so everything aligns
O13  [P1]     CLI powered by the SDK, to dog-food it
O14  [P1,P3]  Abstracting the generated layer - ConnectRPC output is verbose and loses idioms, so hand-wrap it
O15  [P3]     AI does the wrapping - Go proverbs as the style spec, linters as the feedback loop
O16  [P2]     Go vs JS vs Java - the same encrypt in three shapes
O17  [P2]     Our experience is not theirs - use their idioms
O18  [P2]     Failure evidence - third parties misread the spec, then internal SDKs disagreed too
O19  [P2]     The permutation matrix is the real unit of correctness
O20  [P2]     The compatibility matrix runs on every merge
O21  [P2]     A shared CLI shape abstracts the idioms away
O22  [P2]     Divergence reveals underspecification - and the spec is what changes
O23  [P3]     AI in building - code reviews, proto development, proto alignment
O24  [P3]     SDK as guardrail for AI-written customer code - enums become compile errors
O25  [P3]     Training data from 2019 cannot drift when the model works through a typed surface
O26  [P3]     Docs as BDD - defective guides vs defective code
O27  [P3]     A patch is a discrete module - patch library, tests, and its own AGENTS.md
O28  [P3]     Why an agent and not a library - a stop-gap until the right architecture is affordable
```

<!-- pos: 0,0 -->
<!-- kicker: 00 — Opening -->
<!-- goal: state the thesis in one line: the opinion is the product, and it now ships to models too -->
# SDKs ship opinions: first to developers, now to their models

A case study in OpenTDF's developer experience.

<footer align="left">
Ryan Schumacher · OpenTDF Architect and Maintainer
</footer>

<!-- note

- we're exploring the evolution of OpenTDF
- it's refactor started on the cusp of AI
- today most code is written by models

-->
---
<!-- pos: 1,0 -->
<!-- kicker: 01 — Scope -->
<!-- covers: O1 -->
<!-- goal: one sentence on what OpenTDF is - policy travels with the data - and move on -->
# Data-centric security simplified

An open format where policy and keys travel with the data.

<!-- data blocks -->
| 1 | 2 | 3 | 5 |
|---|---|---|---|
| platform | specs | sdks | services |
<!-- data blocks -->

> No is temporary, yes is forever.
> - API maxim

<!-- note

- OpenTDF is about data-centric security and ABAC and TDF
  - TDF, trusted data format
    - Open format for encrypted data bundled with key material
    - Tagged with attributes
    - ZTDF and NanoTDF
      - Nano exists because full TDF is too heavy for constrained
        payloads (IoT, small messages) — a size/capability trade-off
      - two specs doubles the conformance surface: the matrix is
        3 languages × 2 formats, not just languages pairwise
      - say "two specs" like it costs something, because it does
  - ABAC, attribute based access control
    - Access control based on mapping between attributes
    - data attrs : subj attrs
  - DCS, data centric security
    - security at the data layer
- we started off with a core platform
  - consider logging, audit, authz, cache, modular binary, service runner, etc
- built policy service made of multiple primitives and relationships (6 prim of various complexity)
- the maxim, if asked: everything an API exposes is a yes you can
  never take back — on-prem you can't even see who depends on it.
  An SDK is the mechanism for saying no (narrow surface, opinionated
  workflow) while keeping the noes temporary — you can widen an SDK
  later, cheaply. Callback when Buf breaking-change detection comes
  up: that tooling polices the yeses already said.
- keep TDF to ~one sentence spoken; if Greg wants format depth
  he'll ask

-->
---
<!-- pos: 1,1 -->
<!-- kicker: 01 — Scope -->
<!-- covers: O2,O3,O4 -->
<!-- goal: establish the surface area and the headcount, so the SDK bet reads as forced, not preferred -->
# We tried the other shapes first

- **11+ microservices** with a C++ core wrapped per language
- Every language paid an interop tax **and still owed conformance on top**
- Consolidated into one modular monorepo, native SDKs per language for performance
- Six engineers against all of it: services, three SDKs, the CLI, the format, the crypto

And we cannot watch any of it land. Customers run air-gapped; what comes back
is third-hand, months later, filtered through someone else's incident.

Something had to give. **What gave was the SDK layer.**

<!-- note
- wrapper tax: every SDK inherited C++ build problems, FFI edges,
  and platform quirks — and interop with other wrappers still had
  to be proven separately
- "native" is the point of the consolidation: each language stands
  alone, which is what makes idioms possible later
- the admission line is the setup for the thesis slide — deliver it
  plainly, no hedging
-->
---
<!-- pos: 2,0 -->
<!-- kicker: 02 — What an SDK is -->
<!-- covers: O5,O6 -->
<!-- goal: separate typed transport from the opinion, and show why a silent failure makes the opinion load-bearing -->
# An SDK is an abstraction over an API surface and a workflow

- A generated client is **typed transport**. The SDK is **the opinion** — the order of operations, the things it won't let you get wrong.
- Here the workflow *is* the value: token acquisition, resolving which **key access servers (KAS)** you are authorized against, choosing which one to wrap with, binding policy to payload.
- **Encryption failures are silent.** A hand-rolled integration produces a TDF that looks fine and either won't open later or protects nothing.
- The SDK exists so the wrong sequence **isn't reachable**.
- Developer **perception of the product comes through DX**, if they question the SDK they question the product.

<!-- note

- APIs are untyped, prone to typos, must be referenced in docs
  - AI can easily hallucinate; feedback loop requires round-trip
  - Customers tend to write bespoke abstractions which are just SDKs
- APIs tend to expose full scope of capability; leaves room for interpretation; wrong order or missing step can lead unexpected behavior which is challenging to debug
- Workflow workflows can't always be generated, but generated code offsets the maintenance surface area
- Cross compatibility flows are error prone on a larger scale and have long feedback loops
- Non-technical leadership leans on their technical staff to help them make calls
- Developers will build abstraction if the abstraction is done correctly and solves their problem they will rely on it; increase adoption; increase exploration of other features; increase stickiness

-->
---
<!-- pos: 2,1 -->
<!-- kicker: 02 — What an SDK is -->
<!-- covers: O7 -->
<!-- goal: show that not shipping an SDK does not avoid the problem, it distributes it -->
# The SDK is where change gets absorbed

- Without one, your contract ends up **encoded as literals inside every customer application**
- Competent developers will build one anyway; **once per customer, in private, with no conformance suite behind it**
- Typed enums are the mechanism: values discoverable through the compiler rather than memorized
- The SDK is the one surface where versioning can be *expressed*: a change
  arrives **discoverable and typed, as a compile error, for whoever eventually
  recompiles**. It does not schedule adoption, and it does not reach into an
  environment we cannot see — that lever does not exist.

<!--

- contract embedded in customer environment as literals; hard to force upgrades without notification by package managers; impossible to facilitate updates
- typed SDKs offer discovery
  - compile time error is tight feedback loop for AI

-->
---
<!-- pos: 3,0 -->
<!-- kicker: 03 — Failure evidence -->
<!-- covers: O18,O19 -->
<!-- goal: prove with evidence that a prose spec underdetermines behaviour - two independent readings disagreed -->
# Prose specs underdetermine behavior

**Third parties** implemented our open spec and misread it. Then, internally,
the same thing — and the matrix is where it showed up:

- One implementation **hex-encoded** a field. The others did not.
- Two **stripped the KAS URI**. One left it.
- In nanotdf, the policy got implemented in **a variety of shapes**.

None of these are bugs in the ordinary sense. Every one of them is a place two
careful engineers read the same sentence and built different things.

The permutation matrix — not any single SDK's test suite — **is the real unit
of correctness.**
---
<!-- pos: 3,1 -->
<!-- kicker: 03 — Failure evidence -->
<!-- covers: O18 -->
<!-- goal: show the SDK absorbing reality the spec cannot, without corrupting the spec -->
# Liberal in what it accepts. Strict in what it produces.

- An SDK, unlike a loose collection of libraries, **can absorb reality a spec can't**
- It can support out-of-spec third-party TDFs already in the wild
- Workarounds get quarantined in one place **while the spec itself stays clean**
---
<!-- pos: 4,0 -->
<!-- kicker: 04 — Conformance -->
<!-- covers: O21,O13 -->
<!-- goal: explain why a CLI is the comparable surface: argv in, bytes out, no idioms to honour -->
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
<!-- covers: O19,O20,O22 -->
<!-- goal: land that divergence between implementations is evidence the spec is underspecified, and that the spec is what changes -->
# When implementations diverge, the spec is what was wrong

- The honest limit first: these three SDKs are not independent readings. Six
  engineers, one team, one set of design conversations. **A shared misreading
  can stay green**, and no amount of voting fixes that.
- What the matrix does give you is sharper anyway: when implementations
  disagree, **it is almost never that one is buggy.** It is that the sentence
  they both read did not decide the question.
- **`displayName`.** The spec did not say how to derive it, so every
  implementation derived its own. The matrix surfaced the divergence, and the
  fix was not to pick a winner — **it was to amend the spec.**
- Conformance stops being a regression gate and becomes **a continuous
  ambiguity detector on our own written standard.**

It runs on every merge. That is the difference between a matrix that exists
and a matrix that holds the line.

---
<!-- pos: 5,0 -->
<!-- kicker: 05 — Generation -->
<!-- covers: O8,O9 -->
<!-- goal: one definition yields both sides, so drift is a compile error rather than a discipline problem -->
# One definition, both sides, in lockstep

- **ConnectRPC** generates a server interface and a working client from one
  protobuf definition, and serves the same API over plain HTTP *and* gRPC.
- **Why it, over OpenAPI-first:** OpenAPI would have locked us to HTTP. Adding gRPC later means a second protocol shape and a second source of truth.
- Contracts encapsulated as protobuf — there is always an inspectable contract
- One definition yields an unimplemented server interface and a working client. **Drift between them isn't a discipline problem, it's a compile error.**
- Contract-driven development: align on contracts first; SDK developers **regenerate rather than hand-build surface**
- Per-language surface labor collapsed. `This is why three SDKs is survivable with six.`
---
<!-- pos: 5,1 -->
<!-- kicker: 05 — Generation -->
<!-- covers: O10,O11 -->
<!-- goal: explain why on-prem forces build-time enforcement - there is no telemetry to manage deprecation with -->
# On-prem is why it has to be mechanical

| | |
|---|---|
| **SaaS** | Deprecation is an observability problem. Watch traffic, find the last caller, sunset. |
| **On-prem** | No telemetry. No control over upgrade timing. Compatibility can't be managed operationally at all. |
| **So** | Enforce it at build time — **Buf** breaking-change detection against a baseline, failing the build. The only lever available when you can't see your users. |

This is where *no is temporary, yes is forever* comes due: every surface we
exposed is a yes we cannot retract, and nothing operational can take it back.

---
<!-- pos: 7,0 -->
<!-- kicker: 06 — Idioms -->
<!-- covers: O17 -->
<!-- goal: argue that uniformity serves the maintainer and idiom serves the customer -->
# Uniformity is a maintainer's convenience

> You are the only one who sees all three.

- Your customer sees exactly one SDK. Consistency with the others is **invisible** to them; inconsistency with their language is **glaring**.
- Idiomatic SDKs cost more to build
- They pay back in **support tickets not filed, time-to-first-deploy, and customers who come back**
---
<!-- pos: 7,1 -->
<!-- kicker: 06 — Idioms -->
<!-- covers: O16 -->
<!-- goal: show the JavaScript shape - composition is native -->
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
<!-- pos: 7,2 -->
<!-- kicker: 06 — Idioms -->
<!-- covers: O16 -->
<!-- goal: show the Go shape - variadic options -->
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
<!-- pos: 7,3 -->
<!-- kicker: 06 — Idioms -->
<!-- covers: O16 -->
<!-- goal: show the Java shape - a builder, and why that expectation is legitimate -->
# The same encrypt: Java

Verbose by nature, wants a builder. That expectation is legitimate.

```java
SDK sdk = new SDKBuilder()
    .platformEndpoint(endpoint)
    .clientSecret(id, secret)
    .build();

var cfg = Config.newTDFConfig(
    Config.withDataAttributes(attr)
);
sdk.createTDF(in, out, cfg);
```
---
<!-- pos: 8,0 -->
<!-- kicker: 07 — AI · techniques -->
<!-- covers: O14,O15 -->
<!-- goal: show the generated layer is raw material, and that wrapping it is where idioms come from -->
# The generated layer is not the SDK

- ConnectRPC gives us a correct client. It is also **verbose, and it has no
  idioms** — it is the shape of the proto, not the shape of the language.
- So we hand-wrap it. That wrapping is where Go looks like Go.
- **The style spec is the Go proverbs.** Not a document we wrote — one the
  language community already agreed on, and that a model has actually read.
- **The linters are the feedback loop.** The model writes, the linter judges,
  the model corrects. Nobody hand-reviews a diff to enforce house style.

Generation gave us the surface. This is where the opinion gets added back —
faster, not otherwise-impossible. Codegen is what made six engineers viable;
this is what keeps it from eroding.
---
<!-- pos: 8,1 -->
<!-- kicker: 07 — AI · techniques -->
<!-- covers: O27,O28 -->
<!-- goal: land the patch-module pattern, and answer why an agent rather than a library -->
# A patch is a module, and the model is the developer

**Scope first, because it matters:** this is an *adjacent* implementation, not
the OpenTDF SDKs. It does not run the conformance matrix. It was temporary.

The patch is not a diff on a branch. It is a **discrete module**: the patch
library, its tests, and an `AGENTS.md` saying what it is for and when it
applies. When upstream moves, a patch skill applies it again — **an agent reads
the description and does the work**, with the tests as the floor.

> Why an agent and not a library?

Because you do not always get to apply the right architecture at the moment you
need it, least of all around code generation. This was an honest stop-gap that
survived upstream moving — and it earned a lower bar than the SDKs because it
was not the thing whose failures are silent.
---
<!-- pos: 8,2 -->
<!-- kicker: 07 — AI · techniques -->
<!-- covers: O23 -->
<!-- goal: show AI watching upstream so downstream SDK work is staged, not discovered -->
# Watching upstream so the SDKs do not fall behind

Six engineers built OpenTDF. Virtru has sixty, and the platform now underpins
the whole product — so the protos move without us.

- An agent watches proto diffs and **stages the downstream SDK work** before
  anyone notices the drift.
- The same agent does the unglamorous alignment: making one endpoint's surface
  look like its neighbour's, so the SDK reads as one thing.

The failure mode this replaces is finding out at release.
---
<!-- pos: 8,3 -->
<!-- kicker: 07 — AI · techniques -->
<!-- covers: O26 -->
<!-- goal: land docs-as-executable-spec and the two-way check it produces -->
# The quick start is a test case

Run a model against the quick start and the help text, and treat the
documentation as the spec it claims to be. BDD with markdown instead of feature
files, and an agent instead of step definitions.

It is a **two-way check**: if the agent cannot follow the docs to a working
integration, either the docs lie or the SDK regressed — and you learn which
before a customer does.
---
<!-- pos: 9,0 -->
<!-- kicker: 08 — AI · pitfalls -->
<!-- covers: O24 -->
<!-- goal: establish that the model is good at filling typed parameters and bad at choosing the sequence -->
# The SDK is the guardrail for AI-written integration code

- **Strong:** producing plausible integration code fast, filling typed parameters, working from a contract in front of it
- **Weak:** knowing which of four plausible sequences is correct. More context doesn't fix it — **the correct sequence isn't written anywhere in the API surface.** It lives in the workflow opinion.
- Without an SDK you're asking a model to reconstruct your protocol from endpoints. With one, its job shrinks to **filling typed parameters** — the part it's reliably good at.
- Every constraint pushed into the type system is a check at build time instead of a bug that ships
---
<!-- pos: 9,1 -->
<!-- kicker: 08 — AI · pitfalls -->
<!-- covers: O24 -->
<!-- goal: show that compile-time errors beat request-time errors for an agent, and why -->
# Compilation is a faster feedback loop than a request

- A type checker reports **every** wrong argument at once. An endpoint rejects on the first thing it hits, so the agent iterates serially — one request and one context window per attempt
- **An SDK gives errors before side effects.** A failed call costs something; created data, consumed a token, or half-written state. Compile errors are free to be wrong.
- Docstrings and types are context the model gets **without paying to discover it**
- Verbose server errors cost bandwidth and network-layer resources in environments where customers pay for both
---
<!-- pos: 9,2 -->
<!-- kicker: 08 — AI · pitfalls -->
<!-- covers: O25 -->
<!-- goal: explain that deprecated-but-real API surface looks fine to everyone who was not there -->
# Seven years of architecture, none of it timestamped

- OpenTDF has been public since **2019**. Model weights don't encode which data is fresher.
- It generates confidently against a shape we deprecated years ago, and the output looks plausible **because it was correct once.**
- Deprecated-but-real API surface **looks fine to everyone** who's none the wiser.
- Generated artifacts are the only trustworthy source *precisely because they're regenerated rather than recalled*
---
<!-- pos: 10,0 -->
<!-- kicker: 09 — Close -->
<!-- covers: O11 -->
<!-- goal: close on the through-line: no visibility into the environment means every guarantee must be mechanical -->
# We can't see into the environment. So every guarantee has to be mechanical.

| | |
|---|---|
| **No telemetry** | Compile-time checks instead of runtime observation. |
| **No upgrade control** | Breaking-change detection against a baseline. |
| **No visibility into their models** | A typed SDK carrying the installed version's shape. |
