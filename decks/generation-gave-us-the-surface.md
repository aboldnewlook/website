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
- TDF: open format, encrypted data + key material, attribute-tagged
- ABAC: data attrs : subject attrs · DCS: security at the data layer
- nano exists for constrained payloads - a size/capability trade
- two specs doubles conformance: 3 languages x 2 formats
- core platform first; policy service, 6 primitives
- keep TDF to one sentence - let Greg ask for format depth
- if asked, the maxim: every API yes is permanent, an SDK keeps the noes
  temporary (callback at Buf breaking-change detection)
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
- APIs are untyped and doc-dependent - easy to hallucinate against
- 7 years of training data, no past/present sense, SaaS is not on-prem
- full capability exposed: wrong order or missing step, hard to debug
- workflow rarely generates; generated code offsets the maintenance
- token acquisition is custom · KAS brokering is the visible one-off
- non-technical leadership leans on their staff for the call
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
- contract embedded as literals in the customer environment
- no package-manager notification, so you cannot force or facilitate upgrade
- new endpoints mean performance, cost, experience they never get
- compile-time error is a tight loop - for humans and for models
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

On-prem and air-gapped exacerbates this giving no observability path.

Every surface exposed is a yes we cannot retract. (*no is temporary, yes is forever*)

<!-- notes:
- buf can detect breaking changes
-->

---
<!-- down -->
<!-- kicker: 03 — Generation -->
<!-- covers: generative-validation -->
<!-- goal: show that one contract also yields validation, so bad input dies in the caller rather than on the wire -->
# The contract validates too

Constraints declared once in the proto, generated into every SDK.

- **Same validation code** on server and in each SDK.
- Bad input fails **in the caller**, before a request exists.
- Stresses good unit tests. **A request never sent can't be observed** reflecting our customer environments.
- Reduced surface area; fewer discipline problems and more generated artifact.

<!-- notes:
- the value is that validation runs before a request is ever made, not after
  it reaches the server
- the server validates too, and the bit worth landing is that it is the same
  validation on both sides - not two implementations that happen to agree
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
- Idiomatic SDKs cost more to build.
- They pay back in **support tickets not filed, time-to-first-deploy, and customers who come back**

<!-- notes:
- slow down - this is the one I care most about
- teams build the SDK for themselves, not for the person using it
- name it: a product engineering failure, not a difference of taste
-->

---
<!-- down -->
<!-- kicker: 04 — Idioms -->
<!-- covers: three-shapes -->
<!-- goal: show the same encrypt in three idiomatic shapes at once, so the comparison is seen rather than remembered -->
# The same encrypt, three times

<slide-compare layout="mosaic">

**JavaScript**

```ts
const interceptors = [authTokenInterceptor(getToken)];

const client = new OpenTDF({
  interceptors,
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

</slide-compare>

<!-- notes:
- JS: composition is native - build the object, pass it at the call site
- Go: variadic options, extend before the call or inside it
- Java: verbose by nature, wants a builder - a legitimate expectation
- three right answers; a uniform API is wrong in at least two
-->

---
<!-- down -->
<!-- kicker: 05 — Conformance -->
<!-- covers: shared-cli-shape,cli-dogfoods -->
<!-- goal: land that language idioms diverge while Unix idioms converged, which is what makes a CLI comparable -->
# Language idioms diverge. Unix idioms converged.

- The tension: SDKs must be idiomatic, therefore **non-uniform**, therefore hard to compare mechanically.
- A CLI is not idiom-free. **Unix settled all of it**.
- What is left is an opinion: noun→verb or verb→noun.
- BDD encoded as a matrix of shims with shared interfaces, run with **bats**.

```sh
# one shape, asserted: filter the field, diff against what we expect
otdfctl policy attributes list --json | jq -r '.[].fqn' | diff -u expected/attrs.txt -

# the matrix: encrypt with one shim, decrypt with another
echo "hello world" | "$enc" encrypt | "$dec" decrypt | diff -u fixtures/hello.txt -
```

<!-- notes:
- the three shapes were all correct - that is the point
- a CLI has no idioms to honour: argv in, bytes out
- so it is the one surface where all three compare directly
- and we dog-food it - the CLI runs on the SDK
- the assertion is diff, not grep: grep passes on a superset
- diff is silent and exits 0 on a match, so it composes in a test runner
- $enc / $dec iterate the shims - that loop IS the matrix
-->
---
<!-- down -->
<!-- kicker: 04 — Idioms -->
<!-- covers: wrap-the-generated-layer,ai-does-the-wrapping -->
<!-- goal: show the generated layer is raw material, and that wrapping it is where idioms come from -->
# The generated layer is not purely the SDK

- ConnectRPC gives us a correct client. It is also **verbose, it is the shape of the proto**.
- So we wrap it so Go looks like Go.
- **The linters are the feedback loop.** Nobody hand-reviews a diff to enforce house style.

<!-- notes:
- ConnectRPC gets us most of the way to an idiomatic shape
- it breaks down at the edges - enums are the clearest case
- that was still the starting point, and it shipped
- so: shims over the generated layer, written by agents
- the linter checks style and closes the loop
- the trade: every shim is more surface for a defect
-->

---
<!-- kicker: 05 — Conformance -->
<!-- covers: divergence-evidence,permutation-matrix -->
<!-- goal: prove with evidence that a prose spec underdetermines behaviour - two independent readings disagreed -->
# Prose specs underdetermine behavior

**Third parties** implemented our open spec and misread it. Then, internally,
the same thing. The matrix is where it showed up:

- One implementation **hex-encoded** a field. The others did not.
- Two **stripped the KAS URI**. One left it.
- In nanotdf, the policy got implemented in **a variety of shapes**.

None of these are bugs in the ordinary sense. Every one of them is a place two
careful engineers read the same sentence and built different things.

The permutation matrix — not any single SDK's test suite — **is the real unit
of correctness.**

<!-- notes:
- liberal in what it accepts, strict in what it produces
- out-of-spec third-party TDFs are already in the wild, unfixable
- an SDK absorbs that; the workarounds quarantine in one place
- all three showed up in the matrix - none in any single SDK's tests
-->

---
<!-- kicker: 05 — Conformance -->
<!-- covers: permutation-matrix,runs-every-merge,spec-is-what-changes -->
<!-- goal: land that divergence between implementations is evidence the spec is underspecified, and that the spec is what changes -->
# When implementations diverge, the spec is what was wrong

- What the matrix does give you is sharper anyway: when implementations
  disagree, **it was almost never that one is buggy.**
- **`displayName`.** The spec did not say how to derive it, so every
  implementation derived its own. The matrix surfaced the divergence, and the
   **fix was to amend the spec.**
- Conformance stops being a regression gate and becomes
  **a continuous ambiguity detector on our own written standard.**

<!-- notes:
- if asked what changed: displayName was one amendment, the real answer is binarytdf
- ztdf/nanotdf showed the model was wrong - derivatives agree on features, not bytes
- binarytdf designs parity in rather than discovering it
- spec-first, deterministic tooling, deliberately not models - the counterweight
  to the AI section
- do NOT volunteer it: in development, no good answer on outcomes yet
-->


---
<!-- kicker: 06 — AI · techniques -->
<!-- covers: patch-as-module -->
<!-- goal: land the patch-module pattern; why-an-agent is answered verbally, see notes -->
# A patch is a module, and the model is the developer

<slide-callout tone="note">

Adjacent implementation of the OpenTDF SDK.

</slide-callout>

- The patch is not a diff on a branch.
- It is a **discrete module**: the patch library, its tests, and a markdown for the agent.
- When upstream moves, a patch skill applies it again and tests drive the feedback loop.


<!-- notes:
- scope it: adjacent implementation, not the OpenTDF SDKs, never ran the matrix
- the module is the unit: patch library, tests, AGENTS.md
- why an agent, not a library (cut from the slide, say it): a library does not
  define the hook surface or the sequence; an agent applies it in the right
  order even where the hook points do not exist
- be honest - a stop-gap that survived upstream moving
-->
---
<!-- down -->
<!-- kicker: 06 — AI · techniques -->
<!-- covers: ai-in-building -->
<!-- goal: show AI watching upstream so downstream SDK work is staged, not discovered -->
# Watching upstream so the SDKs do not fall behind

Six engineers built OpenTDF. Virtru has sixty, and the platform now underpins
the whole product.

- Humans driving agents implement features faster than one SDK team can process
- Agents watch for drift, realign where possible or alert where not

The failure modes this replaces:

- Customers acting as QA
- Customers resorting to APIs

<!-- notes:
- six built it; Virtru has sixty, and the platform now underpins the product
- the asymmetry is the point - upstream ships faster than one SDK team absorbs
- agents watch for drift: realign where they can, alert where they cannot
- the failure this replaces is the customer finding it first
-->

---
<!-- down -->
<!-- kicker: 06 — AI · techniques -->
<!-- covers: docs-as-bdd -->
<!-- goal: land docs-as-executable-spec and the two-way check it produces -->
# The quick start is a test case

- Run a model against the quick start and the help text, and treat the
  documentation as **the spec it claims to be**.
- BDD with **markdown instead of feature files**, and an agent instead of step
  definitions.
- It is a **two-way check**: if the agent cannot follow the docs to a working
  integration, either the docs lie or the SDK regressed.
- You learn which **before a customer does**.

<!-- note:
- this has caught hallucinations introduced by AI
-->

---
<!-- kicker: 07 — AI · pitfalls -->
<!-- covers: sdk-as-guardrail -->
<!-- goal: establish that the model is good at filling typed parameters and bad at choosing the sequence -->
# The SDK is the guardrail for AI-written integration code

- **Strong:** producing plausible integration code fast, filling typed parameters, working from a contract in front of it
- **Weak:** knowing which of four plausible sequences is correct. More context doesn't fix it since **the correct sequence isn't written anywhere in the API surface.**
- Without an SDK you're asking a model to reconstruct your protocol from endpoints. With one, its job shrinks to **filling typed parameters** the part it's reliably good at.
- Every constraint pushed into the type system is a check at build time instead of a bug that ships

<!-- notes:
- 30s of this only if the room is technical
- type checker flags every wrong arg at once; an endpoint fails on the first,
  so the agent iterates serially - one request, one context window each
- SDK errors land BEFORE side effects; a failed call may already have written
- docstrings and types are free context · verbose errors cost their bandwidth
- if asked for evidence: reasoning about how models work, not a logged incident
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

<!-- notes:
- public since 2019 - weights carry no sense of which data is fresher
- the trap: the output looks plausible because it WAS correct once
- deprecated-but-real is the dangerous kind - nobody in the room can tell
- regenerated, not recalled, is why the generated artifact is the safe source
-->
---
<!-- kicker: 08 — Close -->
<!-- covers: opinion,contract-first,build-time-enforcement,typed-surface-beats-training-data -->
<!-- goal: close on the through-line, and re-land all three prompt items - why an SDK, what generation bought, where AI fits -->
# We can't see into the environment. So every guarantee has to be mechanical.

| | |
|---|---|
| **Why an SDK** | No telemetry, no upgrade control. The wrong sequence has to be **unreachable**, not discouraged. |
| **Generation** | One definition drives both sides, and a breaking change fails **our build** instead of their deploy. |
| **AI** | The typed surface is the guardrail — the model works against the **installed shape**, regenerated rather than recalled. |

<!-- notes:
- the through-line: no visibility means every guarantee has to be mechanical
- read it down the left - the three answers, in the order they were argued
- callback to 1,2: six engineers and no way to watch it land
- no new material here, and stop talking after the last row
-->
