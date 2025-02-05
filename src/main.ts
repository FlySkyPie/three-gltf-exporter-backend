import express, { json, urlencoded } from "express";
import openapi from '@wesleytodd/openapi';

const app = express();

app.use(
  urlencoded({
    extended: true,
  })
);
app.use(json());

const oapi = openapi({
  openapi: '3.0.0',
  info: {
    title: 'Express Application',
    description: 'Generated docs from an Express api',
    version: '1.0.0',
  }
})

// This will serve the generated json document(s)
// (as well as the swagger-ui if configured)
app.use(oapi);

app.use('/swaggerui', oapi.swaggerui())

// To add path specific schema you can use the .path middleware
app.get('/', oapi.path({
  responses: {
    200: {
      description: 'Successful response',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              hello: { type: 'string' }
            }
          }
        }
      }
    }
  }
}), (req, res) => {
  res.json({
    hello: 'world'
  })
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
  console.log(`SwaggerUI can be access at http://localhost:${port}/swaggerui`);
});
