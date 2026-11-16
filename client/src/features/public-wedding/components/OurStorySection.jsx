import { demoStoryCaptions } from '../data/demoWedding.js';

export default function OurStorySection({ ourStory }) {
  if (!ourStory || (!ourStory.description && !ourStory.images?.length)) return null;

  return (
    <section className="story-section section-pad" id="our-story">
      <div className="section-heading section-heading--center">
        <span className="eyebrow">Chapter one</span>
        <h2>How We Met</h2>
        <span aria-hidden="true" className="heading-rule" />
        {ourStory.description && <p>{ourStory.description}</p>}
      </div>
      {!!ourStory.images?.length && (
        <div className="story-grid">
          {ourStory.images.slice(0, 2).map((image, index) => (
            <figure className={`story-card story-card--${index + 1}`} key={image.id}>
              <img alt={image.altText} loading="lazy" src={image.url} />
              <figcaption>
                <span>{demoStoryCaptions[image.id]?.title}</span>
                <span>{demoStoryCaptions[image.id]?.detail}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
