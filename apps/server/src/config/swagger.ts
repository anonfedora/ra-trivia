import swaggerJsdoc from 'swagger-jsdoc';

const API_URL = process.env.API_URL || 'http://localhost:4000';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'RA Trivia API',
            version: '1.7.0',
            description: 'Professional quiz platform API documentation for candidate assessments.',
            contact: {
                name: 'API Support',
                url: 'https://ra-trivia.vercel.app',
            },
        },
        servers: [
            {
                url: `${API_URL}/api`,
                description: 'API Server',
            },
        ],
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Enter your JWT token in the format: Bearer <token>',
                },
            },
        },
        security: [
            {
                BearerAuth: [],
            },
        ],
    },
    apis: ['./src/routes/*.ts', './src/index.ts'], // Path to the API docs
};

export const swaggerSpec = swaggerJsdoc(options);
