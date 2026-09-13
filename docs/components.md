# Components

IntentForge owns installation, service composition, shared navigation, and saved
environment configuration. It combines the same versioned applications used by
the independently usable products.

| Product | Included version | Owns | Integration contract |
| --- | --- | --- | --- |
| [Intent](https://github.com/neutral/intent) | 0.1.0 | Software Knowledge, implementation Descriptions, Check definitions, reviewed authoring, and selected static exports. | [Intent integration](https://github.com/neutral/intent/blob/main/docs/integration.md) |
| [Atlas](https://github.com/neutral/atlas) | 0.9.0 | Project knowledge and context, source grants, reviewed authoring, publication selections, and explicitly authorized adopted-Check evaluation. | [Atlas integration](https://github.com/neutral/atlas/blob/main/docs/integration.md) |
| [Forge](https://github.com/neutral/forge) | 0.1.0 | Directions, direct STEER, saved Worker bindings, authored PROGRESS, and the Work cockpit. | [Forge integration](https://github.com/neutral/forge/blob/main/docs/integration.md) |

The independent applications use the npm package names `@neutral/intent`,
`@neutral/atlas`, and `@neutral/forge`. Their installation guides cover npm/npx
and standalone routes: [Intent](https://github.com/neutral/intent/blob/main/docs/install.md),
[Atlas](https://github.com/neutral/atlas/blob/main/docs/install.md), and
[Forge](https://github.com/neutral/forge/blob/main/docs/install.md).
IntentForge installs their complete runtime-free payloads with one shared runtime.
npm distributes the `intentforge` command; its installed shell script requires no
host Node. An npm archive and a saved Docker image support offline installation
with the same tools. Component source and package qualification do not establish
that a package or suite image has been published.

The Director chooses goals, Workers, continuation, and changes to integrate.
Workers develop in the selected container, use project tools, assess results, and
write useful PROGRESS. Each Worker has its own Direction; Directions may share a
workspace. Installing Forge natively changes the controller's location, while
Worker execution remains in the selected container.

Directors and Workers invoke Intent and Atlas through their own tools. Forge
neither retrieves their knowledge nor interprets or mediates their authoring.
Intent defines Checks; project tools and people or agents perform verification.
Atlas evaluates an adopted Check only through its explicitly authorized capability.
The supplied Atlas evaluator registry is empty. Required adopted Checks can remain
`unable` without a trusted evaluator selected by the host; the suite supplies no
evaluator configuration or implicit pass.

| Term | Meaning |
| --- | --- |
| Intent Check | A software verification definition with subjects, criteria, and supported Knowledge. |
| Atlas Check | An adopted requirement for maintaining a particular Atlas. |
| Forge checklist | Working concerns and references for one Direction. |
| Forge PROGRESS | A stored account deliberately authored by its Worker. |
| Native host events | Transport and execution observations from the agent host. |

Opening the landing page or a component creates no Direction, initializes no
collection, and applies no authored changes. Each product retains its own scope,
review, application, session, and access rules. IntentForge adds no Check runner,
workflow engine, completion or merge authority, spending monitor, mandatory agent
hierarchy, or automatic disposal.

Product repositories own formats, APIs, and control semantics. The selected
project owns its implementation, services, tests, and verification results.
[Neutral Disciplines](https://github.com/neutral/neutral-disciplines) supplies
optional engineering advice for Intent; select practices or Sets and review their
adoption in the project.
