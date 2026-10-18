// Edit visible website content here. Placeholder fields do not claim personal facts.
export const siteContent = {
  name: 'Muhammad Ali',
  navigation: [
    { id: 'home', label: 'Home' },
    { id: 'about', label: 'About' },
    { id: 'skills', label: 'Skills' },
    { id: 'contact', label: 'Contact' },
  ],
  home: {
    terminal: 'terminal.app',
    role: 'Creative Developer & Visual Artist',
    directories: ['drwxr-xr-x design/', 'drwxr-xr-x video/', 'drwxr-xr-x photography/'],
    mission: ['Crafting digital experiences through code and creativity.', 'Specializing in graphic design, video production, and photography.'],
    typingText: 'CREATIVE.HACKER.PORTFOLIO',
    cards: [
      { section: 'about', title: './about.sys', description: 'About Me' },
      { section: 'skills', title: './skills.mov', description: 'My Skills' },
      { section: 'contact', title: './contact.raw', description: 'Get in Touch' },
    ],
    scroll: 'scroll_down()',
  },
  // Original gallery images are decorative placeholders; replace them when ready.
  about: {
    title: 'ABOUT',
    type: 'design' as const,
    description: 'Add a short introduction here.',
    items: [{ id: 'about-1', type: 'design' as const, image: 'https://images.unsplash.com/photo-1690228254548-31ef53e40cd1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxicmFuZGluZyUyMGRlc2lnbnxlbnwxfHx8fDE3NTU1MDA5ODZ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral', title: 'About me', description: 'Replace this text with your biography, interests, and goals.', tags: ['Your interests'] }],
  },
  skills: {
    title: 'SKILLS',
    type: 'video' as const,
    description: 'Add your skills and areas of interest here.',
    items: [{ id: 'skill-1', type: 'video' as const, image: 'https://images.unsplash.com/photo-1670437064362-77a7f5a9f57f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2aWRlbyUyMHByb2R1Y3Rpb24lMjBjaW5lbWF8ZW58MXx8fHwxNzU1NDk3OTY5fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral', title: 'Your skill', description: 'Describe a skill and your experience here.', tags: ['Your tools'] }],
  },
  contact: {
    title: 'CONTACT.INTERFACE',
    description: "Ready to collaborate? Initialize a connection and let's create something amazing together.",
    formTitle: 'message.send()',
    fields: { name: '--name', email: '--email', message: '--message' },
    placeholders: { name: 'Enter your name...', email: 'your.email@domain.com', message: "Hello! I'd like to discuss..." },
    submit: 'Execute Send',
    submitting: 'Transmitting...',
    terminal: 'terminal.log',
    initialOutput: ['> system_status: online', '> contact_form: initialized', '> waiting_for_input...'],
    processingOutput: ['> processing_message...', '> validating_input...', '> establishing_connection...'],
    successOutput: ['> message_sent: success', '> thank_you_for_reaching_out!'],
    errors: {
      configuration: 'Contact service is not configured yet. Please try again later.',
      rateLimit: 'Too many requests. Please wait a minute and try again.',
      validation: 'Check your details, wait a few seconds, and try again.',
      delivery: 'Delivery could not be confirmed. Please try again later.',
    },
    linksTitle: 'connection.links',
    // Set href to your real URL to enable a link.
    links: [
      { label: 'email.sh', value: 'Add your email', href: '' },
      { label: 'github.com', value: 'Add your GitHub URL', href: '' },
      { label: 'linkedin.com', value: 'Add your LinkedIn URL', href: '' },
      { label: 'location.geo', value: 'Add your location', href: '' },
    ],
  },
  footer: {
    copyright: '© 2024 Creative.Hacker.Portfolio - Crafted with code and creativity',
    status: 'Online', lastUpdate: '2024.08.18', version: 'v1.0.0',
  },
};
