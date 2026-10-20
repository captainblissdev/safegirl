import { TOPICS, type Topic } from "../content/topics";
import { TOPIC_ICONS } from "./topicIcons";

/**
 * The four topics as buttons, each opening its Topic list: the one
 * shared component wherever they appear (the clarify reply, the
 * no-answer reply and the Help sheet). Two equal columns that can shrink
 * (minmax(0, 1fr)), and labels that wrap, so nothing runs past the card
 * on a narrow phone.
 * - "grid": 58px buttons with a tinted icon tile (clarify).
 * - "pills": 44px pills, no icon (no answer, Help sheet).
 */
export default function TopicChoices({
  variant,
  onTopic,
}: {
  variant: "grid" | "pills";
  onTopic: (topic: Topic) => void;
}) {
  return (
    <ul className={`topic-choices topic-choices--${variant}`}>
      {TOPICS.map((topic) => {
        const Icon = TOPIC_ICONS[topic.topicClass];
        return (
          <li key={topic.topicClass}>
            <button
              className={`topic-choice topic-choice--${topic.topicClass}`}
              type="button"
              data-topic={topic.topicClass}
              onClick={() => onTopic(topic)}
            >
              {variant === "grid" && (
                <span className="topic-choice-icon">
                  <Icon size={18} />
                </span>
              )}
              <span className="topic-choice-label">{topic.label}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
