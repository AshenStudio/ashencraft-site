# AshenCraft website - static files + stdlib proxy server.
FROM python:3-slim
WORKDIR /app
COPY . .
RUN chmod +x /app/start.sh
EXPOSE 80
CMD ["/app/start.sh"]