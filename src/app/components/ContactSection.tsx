import { siteContent } from '../../config/siteContent';
import { sendContact } from '../../lib/contact';
import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Card } from './ui/card';
import { Mail, Github, Linkedin, Terminal, Send, MapPin } from 'lucide-react';

export function ContactSection() {
  const content = siteContent.contact;
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [website, setWebsite] = useState('');
  const submitting = useRef(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string[]>(content.initialOutput);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (terminal) terminal.scrollTop = terminal.scrollHeight;
  }, [terminalOutput]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Add terminal-style feedback
    const newOutput = [...terminalOutput];
    newOutput.push(`> ${field}_updated: "${value.substring(0, 20)}${value.length > 20 ? '...' : ''}"`);
    if (newOutput.length > 10) newOutput.shift(); // Keep only last 10 lines
    setTerminalOutput(newOutput);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setIsSubmitting(true);
    setTerminalOutput(prev => [...prev.slice(-5), ...content.processingOutput]);
    try {
      await sendContact(import.meta.env.VITE_CONTACT_API_URL, { ...formData, website, startedAt });
      setTerminalOutput(prev => [...prev, ...content.successOutput]);
      setFormData({ name: '', email: '', message: '' });
      setWebsite('');
      setStartedAt(Date.now());
    } catch (error) {
      const key = error instanceof Error ? error.message : 'delivery';
      const message = content.errors[key as keyof typeof content.errors] ?? content.errors.delivery;
      setTerminalOutput(prev => [...prev, `> message_sent: error`, `> ${message}`]);
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  const icons = [Mail, Github, Linkedin, MapPin];
  const contactLinks = content.links.map((link, index) => {
    const Icon = icons[index];
    return { ...link, icon: <Icon className="w-5 h-5" /> };
  });

  return (
    <section className="py-20 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Section Header */}
        <div className="text-center mb-12">
          <div className="inline-block cyber-border bg-black-light/50 rounded px-6 py-3 mb-4">
            <h2 className="font-mono text-primary">{content.title}</h2>
          </div>
          <p className="font-mono text-muted-foreground max-w-2xl mx-auto">
            {content.description}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Contact Form */}
          <Card className="cyber-border bg-black-light/30 border-primary/20 p-6">
            <div className="flex items-center space-x-2 mb-6">
              <Terminal className="w-5 h-5 text-primary" />
              <h3 className="font-mono text-primary">{content.formTitle}</h3>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4" aria-busy={isSubmitting}>
              <input type="text" name="website" value={website}
                onChange={e => setWebsite(e.target.value)}
                tabIndex={-1} autoComplete="off" aria-hidden="true" hidden />
              <div>
                <label htmlFor="contact-name" className="block font-mono text-sm text-primary mb-2">
                  {content.fields.name}
                </label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="font-mono bg-black-light border-primary/30 focus:border-primary text-primary"
                  placeholder={content.placeholders.name}
                  id="contact-name"
                  name="name"
                  maxLength={100}
                  required
                />
              </div>
              
              <div>
                <label htmlFor="contact-email" className="block font-mono text-sm text-primary mb-2">
                  {content.fields.email}
                </label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="font-mono bg-black-light border-primary/30 focus:border-primary text-primary"
                  placeholder={content.placeholders.email}
                  id="contact-email"
                  name="email"
                  maxLength={254}
                  required
                />
              </div>
              
              <div>
                <label htmlFor="contact-message" className="block font-mono text-sm text-primary mb-2">
                  {content.fields.message}
                </label>
                <Textarea
                  value={formData.message}
                  onChange={(e) => handleInputChange('message', e.target.value)}
                  className="font-mono bg-black-light border-primary/30 focus:border-primary text-primary min-h-[120px]"
                  placeholder={content.placeholders.message}
                  id="contact-message"
                  name="message"
                  maxLength={3000}
                  required
                />
              </div>
              
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary text-black hover:bg-primary/90 font-mono"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full mr-2"></div>
                    {content.submitting}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    {content.submit}
                  </>
                )}
              </Button>
            </form>
          </Card>

          {/* Terminal Output & Contact Info */}
          <div className="space-y-6">
            {/* Terminal Output */}
            <Card className="cyber-border bg-black-light/30 border-primary/20 p-6">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-primary"></div>
                <span className="ml-2 font-mono text-sm text-muted-foreground">{content.terminal}</span>
              </div>
              
              <div ref={terminalRef} role="status" aria-live="polite" className="font-mono text-sm space-y-1 max-h-48 overflow-y-auto">
                {terminalOutput.map((line, index) => (
                  <div key={index} className="text-green-dark">
                    {line}
                  </div>
                ))}
                <div className="text-primary">
                  <span className="animate-pulse">_</span>
                </div>
              </div>
            </Card>

            {/* Contact Links */}
            <Card className="cyber-border bg-black-light/30 border-primary/20 p-6">
              <h3 className="font-mono text-primary mb-4">{content.linksTitle}</h3>
              <div className="space-y-3">
                {contactLinks.map((link, index) => (
                  <a
                    key={index}
                    href={link.href || undefined}
                    aria-disabled={!link.href}
                    className="flex items-center space-x-3 p-3 rounded hover:bg-primary/10 transition-colors duration-200 group"
                  >
                    <div className="text-primary group-hover:text-primary">
                      {link.icon}
                    </div>
                    <div className="flex-1">
                      <div className="font-mono text-sm text-primary">{link.label}</div>
                      <div className="font-mono text-xs text-muted-foreground">{link.value}</div>
                    </div>
                  </a>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}