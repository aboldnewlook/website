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

# The problem
what-opentdf-is  [P1]     What OpenTDF is - policy travels with the data
surface-area     [P1]     Surface area: core platform, 5 services, 3 specs (ztdf, nanotdf, binarytdf), 3 SDKs
    Two shipped - ztdf and nanotdf. binarytdf is the unified one, in development.
    Say "two specs" like it costs something: the matrix is 3 languages x 2 formats.
feature-parity   [P1,P2]  The derivatives are not 1-to-1 compatible - they agree on feature sets, so conformance is feature parity, not identical bytes
headcount        [P1]     Six or seven engineers against all of it
no-telemetry     [P1]     Air-gapped customers and third-hand information

# The case for an SDK
opinion                [P1]  Thesis: API surface plus workflow; generated client is typed transport, SDK is the opinion
silent-failure          [P1]  Encryption failures are silent, so the wrong sequence must be unreachable
they-build-one-anyway   [P1]  Without an SDK, customers hardcode strings and build their own wrapper anyway

# Generation
contract-first               [P1]     Contract-based development via proto
connectrpc                   [P1]     Generate via ConnectRPC - HTTP and gRPC from one definition
breaking-change-detection    [P1]     Backward compatibility enforced mechanically - Buf breaking-change detection fails the build
generative-validation        [P1]     Client-side validation generated across SDKs
build-time-enforcement       [P1]     Code running in the customer's environment gives no signals, so compatibility has to be enforced at build time
    On-prem and air-gapped are our instance of it. The condition is general:
    hosted means you can watch adoption, customer-run means you cannot.
platform-uses-sdk            [P1]     Platform powered by the SDK, so everything aligns
cli-dogfoods                 [P1]     CLI powered by the SDK, to dog-food it

# Idioms
wrap-the-generated-layer     [P2,P3]   Abstracting the generated layer - ConnectRPC output is verbose and loses idioms, so hand-wrap it
three-shapes             [P2]  Go vs JS vs Java - the same encrypt in three shapes
shared-cli-shape         [P2]  A shared CLI shape abstracts the idioms away
their-idioms-not-ours    [P2]  Our experience is not theirs - use their idioms

# Conformance
divergence-evidence      [P1]  Failure evidence - third parties misread the spec, then internal SDKs disagreed too
permutation-matrix       [P1]  The permutation matrix is the real unit of correctness
runs-every-merge         [P1]  The compatibility matrix runs on every merge
spec-is-what-changes     [P1]  Divergence reveals underspecification - and the spec is what changes


# AI
ai-does-the-wrapping                 [P3]  AI does the wrapping - Go proverbs as the style spec, linters as the feedback loop
ai-in-building                       [P3]  AI in building - code reviews, proto development, proto alignment
sdk-as-guardrail                     [P3]  SDK as guardrail for AI-written customer code - enums become compile errors
typed-surface-beats-training-data    [P3]  Training data from 2019 cannot drift when the model works through a typed surface
docs-as-bdd                          [P3]  Docs as BDD - defective guides vs defective code
patch-as-module                      [P3]  A patch is a discrete module - patch library, tests, and its own AGENTS.md
why-an-agent                         [P3]  Why an agent and not a library - a stop-gap until the right architecture is affordable
```

<!-- kicker: 00 — Opening -->
<!-- goal: state the thesis in one line: the opinion is the product, and it now ships to models too -->
# SDKs ship opinions: first to developers, now to their models

A case study in OpenTDF's developer experience.

*Ryan Schumacher · OpenTDF Architect and Maintainer*

<!-- note

- we're exploring the evolution of OpenTDF
- it's refactor started on the cusp of AI
- today most code is written by models

-->
---
<!-- kicker: 01 — Scope -->
<!-- covers: what-opentdf-is -->
<!-- goal: one sentence on what OpenTDF is - policy travels with the data - and move on -->
# Data-centric security simplified

An open format where policy and keys travel with the data.

<slide-stats>

| 1 | 2 | 3 | 5 |
|---|---|---|---|
| platform | specs | sdks | services |

</slide-stats>

<slide-callout tone="quote" source="API maxim">

No is temporary, yes is forever.

</slide-callout>

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
<!-- down -->
<!-- kicker: 01 — Scope -->
<!-- covers: surface-area -->
<!-- goal: show the shapes we tried before this one, so the consolidation reads as earned rather than chosen -->
# We tried the other shapes first

- **11+ microservices** led to one idiom across languages
- SDK powered by C++ core **wrapped per language**
- Web SDK **developed and maintained separately**

<!-- notes:
- multiple microservices led to different restful shapes
- SDK unified, but also dropped language specific idioms
- Web SDK required more conformance work to make sure it aligned
-->

---
<!-- down -->
<!-- kicker: 01 — Scope -->
<!-- covers: headcount,no-telemetry -->
<!-- goal: land the constraint the whole talk rests on - small team, and no way to see what happens next -->
# Six engineers, and no way to watch it land

Six engineers against all of it: services, three SDKs, the CLI, the format, the crypto.

Customers run air-gapped; feedback loop is third-hand, months later, filtered through someone
else's incident.

Something had to give. **What gave was the SDK layer.**

<!-- notes:
- discuss the surface area challenge
- Cross compatibility flows are error prone on a larger scale and have long feedback loops
- discuss what gave and lead into why I pushed for ConnectRPC
-->

---
<!-- kicker: 02 — What an SDK is -->
<!-- covers: opinion,silent-failure -->
<!-- goal: separate typed transport from the opinion, and show why a silent failure makes the opinion load-bearing -->
# An SDK is an abstraction over an API surface and a workflow

- A generated client is **typed transport**. The SDK is **the opinion**.
- The SDK exists so the wrong sequence **isn't reachable**.
  - token acquisition and client configuration against the platform
  - resolving the key access servers (KAS) you are authorized against
  - choosing which one to wrap with and setting the binding strategy
- **Encryption failures are silent.** A TDF that looks fine, but won't decrypt or embeds vulnerabilities is a failure.
- Developer **perception of the product comes through DX**, if they question the SDK they question the product.

<!-- note

- APIs are untyped, prone to typos, must be referenced in docs
  - AI can easily hallucinate; feedback loop requires round-trip
- APIs tend to expose full scope of capability; leaves room for interpretation; wrong order or missing step can lead unexpected behavior which is challenging to debug
- Workflow workflows can't always be generated, but generated code offsets the maintenance surface area
  - token acquisition requires custom code; encode through common libraries; push config through platform
  - visible one-offs can lead to rearchitecture decisions; KAS brokering
  - sometimes it has to be developed per language; except for some flows like FIPS
- Non-technical leadership leans on their technical staff to help them make calls

-->
---
<!-- down -->
<!-- kicker: 02 — What an SDK is -->
<!-- covers: they-build-one-anyway -->
<!-- goal: show that not shipping an SDK does not avoid the problem, it distributes it -->
# They will build one anyway

- Without one, your contract ends up **encoded as literals inside every customer application**
- Competent developers build their own; **once per customer, in private, with no conformance suite behind it**
- Typed enums are the mechanism: values **discoverable through the compiler** rather than memorized

<!-- notes:
- contract embedded in the customer environment as literals; no package-manager
  notification, so you cannot force or even facilitate an upgrade
  - new endpoints can lead to performance improvements, cost reduction, better experience
- customers see the same problem with they engage with an API
- compile-time error is a tight feedback loop — for humans and for models
-->

---
<!-- down -->
<!-- kicker: 02 — What an SDK is -->
<!-- covers: they-build-one-anyway -->
<!-- goal: state precisely what versioning buys, so it never sounds like a lever we do not have -->
# What versioning actually buys

The SDK is the one surface where versioning can be **expressed**: a change
arrives discoverable and typed, as a compile error, or deprecation notice.

- It does not schedule adoption.
- It does not reach into an environment we cannot see.

<!-- notes:
- buf can detect breaking changes
-->

---
<!-- kicker: 03 — Generation -->
<!-- covers: contract-first,connectrpc -->
<!-- goal: one definition yields both sides, so drift is a compile error rather than a discipline problem -->
# One definition, both sides, in lockstep

- **ConnectRPC** generates a server and client code from one contract, serves over plain HTTP *and* gRPC.
- **Why it, over OpenAPI-first:** OpenAPI locked us in one shape HTTP. SDK generation required libraries per language.
- Proto generates unimplemented server interface and a working client. **Drift is a compile error.**
- Per-language surface labor collapsed. **Team focused on what can't be generated.**

<!-- notes:
- HTTP is frequently conflated with REST; protobuf is conflated with gRPC
- SDK generation fit modular binary shape; gRPC or HTTP within service mesh; bits within platform
- OpenAPI implementation looked different in each language; protobuf did this for us
-->

---
<!-- down -->
<!-- kicker: 03 — Generation -->
<!-- covers: breaking-change-detection,build-time-enforcement -->
<!-- goal: land the general condition - code you cannot observe forces build-time enforcement - with on-prem as our instance of it -->
# Their environment gives you no signals

| | |
|---|---|
| **Runs in your environment** | Deprecation is an observability problem. Watch traffic, find the last caller, sunset it. |
| **Runs in theirs** | No telemetry, no upgrade control, no idea who is still on the old path. |
| **So** | Enforce it at build time — **Buf** breaking-change detection against a baseline, failing the build. |

On-prem and air-gapped makes this worse. It is the same problem for anything that
ships into a customer's environment and stops reporting back.

This is where *no is temporary, yes is forever* comes due: every surface we
exposed is a yes we cannot retract, and nothing operational can take it back.

---
<!-- down -->
<!-- kicker: 03 — Generation -->
<!-- covers: generative-validation -->
<!-- goal: show that one contract also yields validation, so bad input dies in the caller rather than on the wire -->
# The contract validates too

Constraints declared once in the proto, generated into every SDK — so the
same rule is enforced in Go, Java and JavaScript without three
implementations of it.

- Bad input fails **in the caller**, before a request exists.
- On-prem that matters twice over: **a request never sent is one we never
  had to observe** — and observation is the thing we do not have.
- One more thing that stops being a discipline problem and starts being a
  generated artifact.

<!-- REVIEW · CONFIRM THE MECHANISM
Written from the outline item ("client-side validation generated across
SDKs") plus the structural argument. Your prep mentioned protovalidate as
"a separate tool, runtime validation" — if that is what this is, the slide
should say so by name, and "runtime" may contradict "before a request
exists". Correct the mechanism before this goes in front of anyone.
-->

---
<!-- kicker: 04 — Idioms -->
<!-- covers: their-idioms-not-ours -->
<!-- goal: argue that uniformity serves the maintainer and idiom serves the customer -->
# Uniformity is a maintainer's convenience

<slide-callout tone="note">

You are the only one who sees all three.

</slide-callout>

- Your customer sees exactly one SDK. Consistency with the others is **invisible** to them; inconsistency with their language is **glaring**.
- Idiomatic SDKs cost more to build
- They pay back in **support tickets not filed, time-to-first-deploy, and customers who come back**
---
<!-- down -->
<!-- kicker: 04 — Idioms -->
<!-- covers: three-shapes -->
<!-- goal: show the same encrypt in three idiomatic shapes at once, so the comparison is seen rather than remembered -->
# The same encrypt, three times

**JavaScript**

```ts
const client = new OpenTDF({
  interceptors: [authTokenInterceptor(getToken)],
  platformUrl,
});

const cipherText = await client.createTDF({
  source: { type: 'stream', location: plainText },
});
```

**Go**

```go
s, err := sdk.New(platformEndpoint,
  sdk.WithClientCredentials(id, secret, scopes),
)

s.CreateTDF(&ciphertext, plaintext,
  sdk.WithDataAttributes(attr),
)
```

**Java**

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

<!-- notes:
- don't read the code — point at the shapes
- JS: composition is native, build the object, pass it at the call site
- Go: variadic options, extend before the call or inside it, developer chooses
- Java: verbose by nature, wants a builder, and that expectation is legitimate
- identical semantics, three right answers — a uniform API would have been
  wrong in at least two of them
-->

---
<!-- kicker: 05 — Conformance -->
<!-- covers: shared-cli-shape,cli-dogfoods -->
<!-- goal: land that language idioms diverge while Unix idioms converged, which is what makes a CLI comparable -->
# Language idioms diverge. Unix idioms converged.

- The tension: SDKs must be idiomatic, therefore **non-uniform**, therefore hard to compare mechanically.
- A CLI is not idiom-free. Flags versus positionals, `-f` versus `--flag`, piping, uniform output — **Unix settled all of it**, and settled it the same way on every platform.
- What is left genuinely arbitrary is small: noun→verb or verb→noun. Pick one, and every language can hit it.
- So the matrix becomes a matrix over **processes**, not language bindings. The harness needs a shell, not knowledge of Java versus Go.
- Every pair tested — encrypt in Java, decrypt in Go — across formats, with **zero language-specific test code**

***

Java, Go, JavaScript. `otdfctl` is a real product CLI; the others are deliberately minimal shims. One product, two test harnesses sharing a shape.
---
<!-- kicker: 04 — Idioms -->
<!-- covers: wrap-the-generated-layer,ai-does-the-wrapping -->
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
<!-- kicker: 05 — Conformance -->
<!-- covers: divergence-evidence,permutation-matrix -->
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

<!-- notes:
- liberal in what it accepts, strict in what it produces — say this out loud,
  it is the line people remember
- an SDK, unlike a loose collection of libraries, can absorb reality the spec
  cannot: out-of-spec third-party TDFs are already in the wild and cannot be
  retroactively fixed
- the workarounds get quarantined in one place, which is what keeps the spec
  itself clean
- the matrix is where all three of these showed up — none were caught by any
  single SDK's own test suite
-->

---
<!-- kicker: 05 — Conformance -->
<!-- covers: permutation-matrix,runs-every-merge,spec-is-what-changes -->
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

<!-- notes:
- if asked "so what changed?" — displayName was one amendment; the larger
  answer is binarytdf
- ztdf and nanotdf taught us where the model was wrong: the derivatives are
  not 1-to-1 compatible, they agree on feature sets, and every ambiguity we
  found came out of that gap
- binarytdf is one unified spec that designs feature parity in rather than
  discovering it. built spec-first with deterministic tooling — deliberately
  NOT with models, which is the counterweight to everything in the AI section
- there is a reality where it makes the other two unnecessary
- do not volunteer this: it is in development, and a question about outcomes
  has no good answer yet
-->

<!-- REVIEW · RYAN TO FILL — deterministic-tooling
The note above says binarytdf is "built spec-first with deterministic tooling —
deliberately NOT with models" and then stops. That sentence is doing a lot of
work and is currently unsupported.

Worth filling in because it is probably the best answer you have to "where
would you NOT use AI" — a boundary you drew, not a capability you claimed,
which is the opposite of the pattern the technical reviewer flagged across
every other AI slide.

What is missing:
- what the deterministic tooling actually IS. Name it. Generators, validators,
  a schema compiler, property tests? Right now "deterministic tooling" could
  mean anything.
- why deterministic for the spec specifically, when models are fine for
  wrapping, patching, upstream watching and docs. What property does a spec
  have that those do not?
- whether this is a principle you hold or a decision you made once for
  binarytdf. Those answer a follow-up very differently.
-->

It runs on every merge. That is the difference between a matrix that exists
and a matrix that holds the line.

---
<!-- kicker: 06 — AI · techniques -->
<!-- covers: patch-as-module,why-an-agent -->
<!-- goal: land the patch-module pattern, and answer why an agent rather than a library -->
# A patch is a module, and the model is the developer

**Scope first, because it matters:** this is an *adjacent* implementation, not
the OpenTDF SDKs. It does not run the conformance matrix. It was temporary.

The patch is not a diff on a branch. It is a **discrete module**: the patch
library, its tests, and an `AGENTS.md` saying what it is for and when it
applies. When upstream moves, a patch skill applies it again — **an agent reads
the description and does the work**, with the tests as the floor.

<slide-callout tone="note">

Why an agent and not a library?

</slide-callout>

Because you do not always get to apply the right architecture at the moment you
need it, least of all around code generation. This was an honest stop-gap that
survived upstream moving — and it earned a lower bar than the SDKs because it
was not the thing whose failures are silent.
---
<!-- down -->
<!-- kicker: 06 — AI · techniques -->
<!-- covers: ai-in-building -->
<!-- goal: show AI watching upstream so downstream SDK work is staged, not discovered -->
# Watching upstream so the SDKs do not fall behind

Six engineers built OpenTDF. Virtru has sixty, and the platform now underpins
the whole product — so the protos move without us.

- An agent watches proto diffs and **stages the downstream SDK work** before
  anyone notices the drift.
- The same agent does the unglamorous alignment: making one endpoint's surface
  look like its neighbour's, so the SDK reads as one thing.

The failure mode this replaces is finding out at release.

<!-- REVIEW · NEEDS AN INSTANCE
Described as a capability, never as something that happened. The deep-technical
reviewer flagged this pattern across every AI slide. One dated example — a
proto change the agent staged before anyone noticed — turns this from a
mechanism into evidence. It is also optional depth: this column hangs off "The
generated layer is not the SDK" and can be dropped whole if questions run long.
-->

---
<!-- down -->
<!-- kicker: 06 — AI · techniques -->
<!-- covers: docs-as-bdd -->
<!-- goal: land docs-as-executable-spec and the two-way check it produces -->
# The quick start is a test case

Run a model against the quick start and the help text, and treat the
documentation as the spec it claims to be. BDD with markdown instead of feature
files, and an agent instead of step definitions.

It is a **two-way check**: if the agent cannot follow the docs to a working
integration, either the docs lie or the SDK regressed — and you learn which
before a customer does.

<!-- REVIEW · NEEDS AN INSTANCE
Has the docs-as-test check ever actually caught a stale guide or a regression?
If yes, name it and this becomes the strongest slide in the techniques column.
If it has not fired yet, say so plainly — "we just stood this up" is more
credible than implied results. Optional depth, same column as "Watching
upstream"; droppable together.
-->

---
<!-- kicker: 07 — AI · pitfalls -->
<!-- covers: sdk-as-guardrail -->
<!-- goal: establish that the model is good at filling typed parameters and bad at choosing the sequence -->
# The SDK is the guardrail for AI-written integration code

- **Strong:** producing plausible integration code fast, filling typed parameters, working from a contract in front of it
- **Weak:** knowing which of four plausible sequences is correct. More context doesn't fix it — **the correct sequence isn't written anywhere in the API surface.** It lives in the workflow opinion.
- Without an SDK you're asking a model to reconstruct your protocol from endpoints. With one, its job shrinks to **filling typed parameters** — the part it's reliably good at.
- Every constraint pushed into the type system is a check at build time instead of a bug that ships

<!-- notes:
- the compile-loop point, verbally — worth 30 seconds if the room is technical:
  - a type checker reports EVERY wrong argument at once; an endpoint rejects on
    the first thing it hits, so an agent iterates serially, one request and one
    context window per attempt
  - an SDK gives errors BEFORE side effects. a failed call may already have
    created data, consumed a token, or half-written state. compile errors are
    free to be wrong.
  - docstrings and types are context the model gets without paying to discover it
  - verbose server errors cost bandwidth in environments where the customer pays
    for both
- if asked for evidence here, be honest: this is reasoning about how models
  work, not an incident we logged
-->

---
<!-- down -->
<!-- kicker: 07 — AI · pitfalls -->
<!-- covers: typed-surface-beats-training-data -->
<!-- goal: explain that deprecated-but-real API surface looks fine to everyone who was not there -->
# Seven years of architecture, none of it timestamped

- OpenTDF has been public since **2019**. Model weights don't encode which data is fresher.
- It generates confidently against a shape we deprecated years ago, and the output looks plausible **because it was correct once.**
- Deprecated-but-real API surface **looks fine to everyone** who's none the wiser.
- Generated artifacts are the only trustworthy source *precisely because they're regenerated rather than recalled*
---
<!-- kicker: 08 — Close -->
<!-- covers: build-time-enforcement -->
<!-- goal: close on the through-line: no visibility into the environment means every guarantee must be mechanical -->
# We can't see into the environment. So every guarantee has to be mechanical.

| | |
|---|---|
| **No telemetry** | Compile-time checks instead of runtime observation. |
| **No upgrade control** | Breaking-change detection against a baseline. |
| **No visibility into their models** | A typed SDK carrying the installed version's shape. |
