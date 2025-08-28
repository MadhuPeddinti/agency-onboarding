FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# Copy package files first for better caching
COPY package*.json ./
RUN npm install --only=production

# Copy app source code
COPY . .

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 3000

# Wait for MySQL to be ready and start the application
CMD ["node", "server.js"]
