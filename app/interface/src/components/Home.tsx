import { useEffect, useRef, type ReactNode } from "react";
import { TOPICS, type Topic } from "../content/topics";
import { SOURCES_LINE } from "../content/uiText";
import DangerLine from "./DangerLine";
import { LockIcon, Sparkle } from "./Icons";
import { TOPIC_ICONS } from "./topicIcons";

/**
 * Home: the empty state of the chat. A hero with the page's only h1, the
 * sources line and the ask pill (the chat's one ask bar, passed in), a
 * 2x2 grid of topic tiles from content/topics.ts, and the footer.
 */

interface Props {
  /** The chat's ask bar, rendered in the hero. */
  askBar: ReactNode;
  /** A topic tile: opens the Topic list for that class. */
  onTopic: (topic: Topic) => void;
}

export default function Home({ askBar, onTopic }: Props) {
  // Focus moves to the h1 when Home appears (after the splash, or a new
  // chat). Coming back from a Topic list, App then focuses the tile.
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="home">
      <section className="hero surface-dark" aria-labelledby="home-title">
        <span className="hero-sparkle" aria-hidden="true">
          <Sparkle size={22} />
        </span>
        <p className="hero-tag">
          <LockIcon size={16} /> Private and anonymous
        </p>
        <h1
          ref={headingRef}
          tabIndex={-1}
          id="home-title"
          className="hero-title"
        >
          Ask about your body, periods, pregnancy or sex.
        </h1>
        <p className="hero-sub">{SOURCES_LINE} This can&apos;t diagnose you.</p>
        {askBar}
      </section>

      <h2 className="home-topics-title" id="home-topics">
        Or browse by topic
      </h2>
      <div className="topic-tiles" role="group" aria-labelledby="home-topics">
        {TOPICS.map((topic) => {
          const Icon = TOPIC_ICONS[topic.topicClass];
          return (
            <button
              key={topic.topicClass}
              className={`topic-tile topic-tile--${topic.topicClass}`}
              data-topic={topic.topicClass}
              type="button"
              onClick={() => onTopic(topic)}
            >
              <span className="topic-tile-icon">
                <Icon size={22} />
              </span>
              <span className="topic-tile-label">{topic.label}</span>
              <span className="topic-tile-sub">{topic.subtitle}</span>
            </button>
          );
        })}
      </div>

      <footer className="home-footer">
        <p className="home-anonymous">Anonymous. We never ask for your name.</p>
        <DangerLine />
      </footer>
    </div>
  );
}
