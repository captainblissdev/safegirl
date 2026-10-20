import type { TopicClass } from "../content/topics";
import { DropIcon, HeartIcon, PillIcon, ShieldIcon } from "./Icons";

/** Each topic's icon, shared by the Home tiles and the Topic list. */
export const TOPIC_ICONS: Record<TopicClass, typeof DropIcon> = {
  general: DropIcon,
  pregnancy: HeartIcon,
  contraception: PillIcon,
  sti: ShieldIcon,
};
