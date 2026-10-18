
import { siteContent } from './siteContent';

const API_URL =
  'https://portfolio-public-api.kmuhammadali.workers.dev';

type SiteContent = typeof siteContent;

async function getJSON(path: string): Promise<unknown> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'GET',
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`CMS API error: ${response.status}`);
  }

  return response.json();
}

export async function loadSiteContent(): Promise<SiteContent> {
  try {
    const [pages, settings, skills] = await Promise.all([
      getJSON('/api/content'),
      getJSON('/api/settings'),
      getJSON('/api/skills'),
    ]);

    const pageData = pages as Partial<SiteContent>;
    const settingsData = settings as Partial<SiteContent>;

    const skillItems = Array.isArray(skills)
      ? skills.map((skill) => ({
          id: skill.id,
          title: skill.title,
          description: skill.description,
          image: skill.image_url ?? '',
          tags: skill.tags,
          type: 'video' as const,
        }))
      : siteContent.skills.items;

    return {
      ...siteContent,
      ...settingsData,
      home: { ...siteContent.home, ...pageData.home },
      about: { ...siteContent.about, ...pageData.about },
      skills: {
        ...siteContent.skills,
        ...pageData.skills,
        items: skillItems,
      },
      contact: { ...siteContent.contact, ...pageData.contact },
    } as SiteContent;
  } catch (error) {
    console.error('CMS content unavailable:', error);
    return siteContent;
  }
}
