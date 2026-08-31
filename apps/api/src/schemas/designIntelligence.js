/**
 * Design Intelligence Schema
 * 
 * Complete schema for the consolidated design intelligence output.
 * Replaces the separate WebsiteStrategy, WebsiteCopy, and LandingPageSpec schemas.
 */

export const DESIGN_INTELLIGENCE_SCHEMA = {
  type: 'object',
  required: [
    'designSystem',
    'pageArchitecture', 
    'contentStrategy',
    'assetPlan',
    'metadata'
  ],
  properties: {
    designSystem: {
      type: 'object',
      required: [
        'visualDirection',
        'brandPersonality',
        'colorSystem',
        'typography',
        'layout',
        'shapeLanguage',
        'motion',
        'imageTreatment',
        'iconTreatment'
      ],
      properties: {
        visualDirection: { type: 'string' },
        brandPersonality: { 
          type: 'array', 
          items: { type: 'string' },
          minItems: 2,
          maxItems: 5
        },
        colorSystem: {
          type: 'object',
          required: ['background', 'surface', 'text', 'mutedText', 'primary', 'secondary', 'accent', 'border'],
          properties: {
            background: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
            surface: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
            text: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
            mutedText: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
            primary: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
            secondary: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
            accent: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
            border: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' }
          }
        },
        typography: {
          type: 'object',
          required: ['display', 'body', 'weightScale', 'letterSpacing'],
          properties: {
            display: {
              type: 'object',
              required: ['family', 'weight', 'lineHeight', 'sizeScale'],
              properties: {
                family: { type: 'string' },
                weight: { type: 'integer', minimum: 100, maximum: 900 },
                lineHeight: { type: 'number', minimum: 1.0, maximum: 1.5 },
                sizeScale: { type: 'string' }
              }
            },
            body: {
              type: 'object',
              required: ['family', 'weight', 'lineHeight', 'sizeScale'],
              properties: {
                family: { type: 'string' },
                weight: { type: 'integer', minimum: 100, maximum: 900 },
                lineHeight: { type: 'number', minimum: 1.4, maximum: 1.8 },
                sizeScale: { type: 'string' }
              }
            },
            weightScale: {
              type: 'object',
              properties: {
                light: { type: 'integer' },
                regular: { type: 'integer' },
                medium: { type: 'integer' },
                semibold: { type: 'integer' },
                bold: { type: 'integer' }
              }
            },
            letterSpacing: {
              type: 'object',
              properties: {
                tight: { type: 'string' },
                normal: { type: 'string' },
                wide: { type: 'string' }
              }
            }
          }
        },
        layout: {
          type: 'object',
          required: ['maxWidth', 'sectionSpacing', 'grid', 'heroComposition'],
          properties: {
            maxWidth: { type: 'string' },
            sectionSpacing: { type: 'string' },
            grid: { type: 'string' },
            heroComposition: { 
              type: 'string',
              enum: ['centered', 'split-left', 'split-right', 'full-bleed', 'asymmetric']
            }
          }
        },
        shapeLanguage: {
          type: 'object',
          required: ['radius', 'buttonShape', 'cardShape', 'inputShape'],
          properties: {
            radius: { type: 'string' },
            buttonShape: { 
              type: 'string', 
              enum: ['rounded', 'pill', 'sharp', 'soft'] 
            },
            cardShape: { 
              type: 'string', 
              enum: ['rounded', 'sharp', 'soft', 'organic'] 
            },
            inputShape: { 
              type: 'string', 
              enum: ['rounded', 'sharp', 'pill'] 
            }
          }
        },
        motion: {
          type: 'object',
          required: ['intensity', 'allowedEffects'],
          properties: {
            intensity: { 
              type: 'string', 
              enum: ['none', 'subtle', 'moderate', 'expressive'] 
            },
            allowedEffects: {
              type: 'array',
              items: { 
                type: 'string',
                enum: ['fade', 'slide', 'scale', 'stagger', 'parallax', 'reveal']
              }
            }
          }
        },
        imageTreatment: {
          type: 'object',
          required: ['aspectRatios', 'overlayStyle', 'borderTreatment', 'shadowStyle'],
          properties: {
            aspectRatios: {
              type: 'array',
              items: { type: 'string' }
            },
            overlayStyle: { 
              type: 'string', 
              enum: ['none', 'gradient', 'tint', 'vignette', 'duotone'] 
            },
            borderTreatment: { 
              type: 'string', 
              enum: ['none', 'rounded', 'sharp', 'organic', 'film'] 
            },
            shadowStyle: { 
              type: 'string', 
              enum: ['none', 'subtle', 'elevated', 'dramatic', 'inner'] 
            }
          }
        },
        iconTreatment: {
          type: 'object',
          required: ['style', 'weight', 'size'],
          properties: {
            style: { 
              type: 'string', 
              enum: ['outline', 'filled', 'duotone', 'hand-drawn', 'minimal'] 
            },
            weight: { type: 'string' },
            size: { type: 'string' }
          }
        }
      }
    },
    pageArchitecture: {
      type: 'object',
      required: ['layoutFamily', 'sections', 'navigation', 'responsive'],
      properties: {
        layoutFamily: { 
          type: 'string', 
          enum: [
            'editorial',
            'luxury', 
            'modern-minimal',
            'bold-modern',
            'warm-artisan',
            'professional',
            'energetic',
            'classic-editorial',
            'split-asymmetric',
            'single-page'
          ]
        },
        sections: {
          type: 'array',
          minItems: 4,
          items: {
            type: 'object',
            required: ['id', 'type', 'priority', 'reason', 'requiredFacts', 'content', 'layout', 'responsive'],
            properties: {
              id: { type: 'string' },
              type: { 
                type: 'string', 
                enum: [
                  'navigation',
                  'hero',
                  'announcement',
                  'services',
                  'featured-service',
                  'about',
                  'story',
                  'gallery',
                  'menu',
                  'testimonials',
                  'trust',
                  'statistics',
                  'location',
                  'hours',
                  'contact',
                  'cta',
                  'footer'
                ]
              },
              priority: { 
                type: 'string', 
                enum: ['critical', 'essential', 'recommended', 'optional', 'conditional'] 
              },
              reason: { type: 'string' },
              requiredFacts: {
                type: 'array',
                items: { type: 'string' }
              },
              content: { type: 'object' },
              layout: { type: 'string' },
              responsive: { type: 'object' }
            }
          }
        },
        navigation: {
          type: 'object',
          required: ['style', 'position', 'mobileBehavior'],
          properties: {
            style: { 
              type: 'string', 
              enum: ['sticky', 'fixed', 'static', 'hidden'] 
            },
            position: { 
              type: 'string', 
              enum: ['top', 'left', 'right'] 
            },
            mobileBehavior: { 
              type: 'string', 
              enum: ['drawer', 'sheet', 'dropdown', 'inline'] 
            }
          }
        },
        responsive: {
          type: 'object',
          required: ['breakpoints', 'heroBehavior', 'gridBehavior'],
          properties: {
            breakpoints: { type: 'object' },
            heroBehavior: { 
              type: 'string', 
              enum: ['stack', 'scale', 'crop', 'reflow'] 
            },
            gridBehavior: { 
              type: 'string', 
              enum: ['stack', 'reflow', 'resize', 'masonry'] 
            }
          }
        }
      }
    },
    contentStrategy: {
      type: 'object',
      required: ['hero', 'sections', 'ctaStrategy', 'trustStrategy', 'voice'],
      properties: {
        hero: {
          type: 'object',
          required: ['headline', 'subheadline', 'cta', 'secondaryCta'],
          properties: {
            headline: { type: 'string' },
            subheadline: { type: 'string' },
            cta: {
              type: 'object',
              required: ['primary', 'action'],
              properties: {
                primary: { type: 'string' },
                action: { type: 'string' },
                reasoning: { type: 'string' }
              }
            },
            secondaryCta: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                action: { type: 'string' }
              }
            }
          }
        },
        sections: {
          type: 'object',
          properties: {
            about: { type: 'object' },
            services: { type: 'object' },
            gallery: { type: 'object' },
            testimonials: { type: 'object' },
            trust: { type: 'object' },
            statistics: { type: 'object' },
            location: { type: 'object' },
            hours: { type: 'object' },
            contact: { type: 'object' },
            cta: { type: 'object' },
            faq: { type: 'object' }
          }
        },
        ctaStrategy: {
          type: 'object',
          required: ['primary', 'secondary', 'microConversions'],
          properties: {
            primary: { type: 'string' },
            secondary: { type: 'string' },
            microConversions: { type: 'array', items: { type: 'string' } }
          }
        },
        trustStrategy: {
          type: 'object',
          required: ['elements', 'placement'],
          properties: {
            elements: { type: 'array', items: { type: 'object' } },
            placement: { type: 'string' }
          }
        },
        voice: {
          type: 'object',
          required: ['tone', 'personality', 'avoid'],
          properties: {
            tone: { type: 'string' },
            personality: { type: 'array', items: { type: 'string' } },
            avoid: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    },
    assetPlan: {
      type: 'object',
      required: ['hero', 'supporting', 'gallery', 'optimization'],
      properties: {
        hero: {
          type: 'object',
          required: ['type', 'subject', 'aspectRatio', 'resolution', 'treatment'],
          properties: {
            type: { 
              type: 'string', 
              enum: ['generated', 'business-photo', 'stock', 'pattern', 'gradient', 'typography'] 
            },
            subject: { type: 'string' },
            aspectRatio: { type: 'string' },
            resolution: { type: 'string' },
            treatment: { type: 'object' }
          }
        },
        supporting: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'purpose', 'subject', 'aspectRatio', 'resolution'],
            properties: {
              id: { type: 'string' },
              purpose: { type: 'string' },
              subject: { type: 'string' },
              aspectRatio: { type: 'string' },
              resolution: { type: 'string' }
            }
          }
        },
        gallery: {
          type: 'object',
          properties: {
            count: { type: 'integer', minimum: 0, maximum: 12 },
            style: { type: 'string' },
            layout: { type: 'string' }
          }
        },
        optimization: {
          type: 'object',
          required: ['formats', 'sizes', 'loading'],
          properties: {
            formats: { type: 'array', items: { type: 'string' } },
            sizes: { type: 'array', items: { type: 'string' } },
            loading: { type: 'object' }
          }
        }
      }
    },
    metadata: {
      type: 'object',
      required: ['generatedAt', 'version', 'model', 'confidence'],
      properties: {
        generatedAt: { type: 'string' },
        version: { type: 'string' },
        model: { type: 'string' },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        reasoning: { type: 'string' }
      }
    }
  }
};