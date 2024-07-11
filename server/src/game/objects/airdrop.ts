import type { ObstacleDef } from "../../../../shared/defs/mapObjectsTyping";
import { GameConfig } from "../../../../shared/gameConfig";
import { ObjectType } from "../../../../shared/net/objectSerializeFns";
import { type Collider, coldet } from "../../../../shared/utils/coldet";
import { collider } from "../../../../shared/utils/collider";
import { math } from "../../../../shared/utils/math";
import { util } from "../../../../shared/utils/util";
import { type Vec2, v2 } from "../../../../shared/utils/v2";
import { MapObjectDefs } from "../../..//../shared/defs/mapObjectDefs";
import type { Game } from "../game";
import { BaseGameObject } from "./gameObject";
import { Emote } from "./player";

export class AirdropBarn {
    airdrops: Airdrop[] = [];

    constructor(readonly game: Game) {}

    addAirdrop(pos: Vec2, type: string) {
        const airdrop = new Airdrop(this.game, pos, type);
        this.airdrops.push(airdrop);
        this.game.playerBarn.emotes.push(new Emote(0, pos, "ping_airdrop", true));
        this.game.objectRegister.register(airdrop);
    }

    update(dt: number) {
        for (let i = 0; i < this.airdrops.length; i++) {
            const airdrop = this.airdrops[i];
            airdrop.update(dt);
        }
    }

    flush() {
        for (let i = 0; i < this.airdrops.length; i++) {
            const airdrop = this.airdrops[i];
            if (airdrop.landed) {
                this.airdrops.splice(i, 1);
            }
        }
    }
}

export class Airdrop extends BaseGameObject {
    override readonly __type = ObjectType.Airdrop;
    bounds = collider.createAabbExtents(v2.create(0, 0), v2.create(5, 5));

    layer = 0;

    fallTime = GameConfig.airdrop.fallTime;
    fallT = 0;
    landed = false;

    obstacleType: string;
    crateCollision: Collider;

    constructor(game: Game, pos: Vec2, obstacleType: string) {
        super(game, pos);
        this.obstacleType = obstacleType;
        const def = MapObjectDefs[this.obstacleType] as ObstacleDef;
        this.crateCollision = collider.transform(def.collision, this.pos, 0, 1);
    }

    update(dt: number) {
        if (this.landed) return;
        this.fallTime -= dt;
        this.fallT = math.remap(this.fallTime, 0, GameConfig.airdrop.fallTime, 1, 0);

        this.fallT = math.clamp(this.fallT, 0, 1);
        this.setPartDirty();
        if (this.fallT === 1) {
            this.landed = true;
            this.setDirty();

            const objs = this.game.grid.intersectCollider(this.crateCollision);
            for (const obj of objs) {
                if (
                    (obj.__type === ObjectType.Player ||
                        obj.__type === ObjectType.Obstacle) &&
                    coldet.test(obj.collider, this.crateCollision) &&
                    util.sameLayer(obj.layer, 0)
                ) {
                    obj.damage({
                        amount: obj.__type === ObjectType.Player ? 100 : 1e10,
                        damageType: GameConfig.DamageType.Airdrop,
                        dir: "dir" in obj ? obj.dir : v2.create(0, 0)
                    });
                } else if (obj.__type === ObjectType.Building && !obj.ceilingDead) {
                    for (const zoomRegion of obj.zoomRegions) {
                        if (!zoomRegion.zoomIn) continue;
                        if (coldet.test(zoomRegion.zoomIn, this.crateCollision)) continue;
                        obj.ceilingDead = true;
                        obj.setPartDirty();
                    }
                }
            }

            this.game.map.genObstacle(this.obstacleType, this.pos, 0);
        }
    }
}
