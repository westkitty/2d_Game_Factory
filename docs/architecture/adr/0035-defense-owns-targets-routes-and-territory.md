# ADR-0035: Defense owns targets, routes and territory; weapons own projectiles

- Phase: Post-ten program Phase 21
- Status: accepted

`sw2d.defense` publishes two services: `strategy.defense` owns tower placement,
upgrades, target selection, lane/base breaches and route safety; `strategy.territory`
owns capture state and scoring. They share the same authored `defense.json` because
a lane objective and a capture point are both level objectives, but their state is
not conflated with strategy turn order.

Blocking placement performs cheap zone/overlap/funds checks before temporarily
blocking the navigation grid and checking every authored route. The temporary
mutation is restored in `finally`; preview and commit call the same rule.

Towers name a Phase-3 weapon. This capability decides *which target* a tower has;
it does not grow a second projectile or cooldown implementation. Route progress
and entity id make target selection deterministic. Capture contests freeze progress
rather than quietly awarding a larger team a speed bonus.
