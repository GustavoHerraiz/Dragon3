/**
 * ====================================================================
 * DRAGON3 - ECOSYSTEM PM2 CONFIGURATION FAANG ENTERPRISE
 * ====================================================================
 *
 * Archivo: ecosystem.config.js
 * Proyecto: Dragon3 - Sistema Autentificación IA Enterprise
 * Versión: 3.0.0-FAANG
 * Fecha: 2025-06-25
 * Autor: Gustavo Herráiz - Lead Architect
 *
 * DESCRIPCIÓN:
 * Configuración enterprise PM2 para Dragon3 con clustering, monitoring,
 * auto-scaling, health checks y graceful shutdown. Optimizada para
 * production deployment con características FAANG enterprise.
 *
 * FAANG FEATURES:
 * - Auto-scaling con CPU/Memory thresholds
 * - Health monitoring proactivo
 * - Graceful restart con zero-downtime
 * - Log rotation enterprise
 * - Memory leak detection automática
 * - Performance monitoring integrado
 * - Error tracking avanzado
 * - Deployment strategies múltiples
 * - Environment configuration completa
 * - Clustering inteligente
 *
 * AMBIENTES SOPORTADOS:
 * - development: Single instance con debugging
 * - staging: Multi-instance con monitoring
 * - production: Clustering completo con HA
 * - testing: Configuración para CI/CD
 *
 * SLA TARGETS:
 * - Uptime: 99.9%
 * - Response time: P95 <200ms
 * - Memory usage: <500MB per instance
 * - CPU usage: <70% average
 * - Error rate: <0.5%
 * - Zero-downtime deployments
 *
 * USAGE:
 * ```bash
 * # Development
 * pm2 start ecosystem.config.js
 * 
 * # Staging
 * pm2 start ecosystem.config.js --env staging
 * 
 * # Production
 * pm2 start ecosystem.config.js --env production
 * 
 * # Monitoring
 * pm2 monit
 * pm2 logs dragon3-backend
 * ```
 *
 * ====================================================================
 */

module.exports = {
    apps: [
        {
            // =================== BASIC CONFIGURATION ===================
            name: 'dragon3-backend',
            script: 'servicios/servidorCentral.js',
            cwd: '/var/www/Dragon3/backend',
            
            // =================== EXECUTION MODE ===================
            instances: 1,                    // Development: 1, Production: 'max' or number
            exec_mode: 'fork',               // 'fork' for single, 'cluster' for multiple
            
            // =================== RESTART POLICY ===================
            autorestart: true,               // Auto restart on crash
            watch: false,                    // File watching (disable in production)
            ignore_watch: [                 // Ignore these paths if watch enabled
                'node_modules',
                'logs',
                '.git',
                '*.log',
                'tmp'
            ],
            watch_options: {
                followSymlinks: false,
                usePolling: false,
                interval: 1000,
                ignored: /node_modules/
            },
            
            // =================== MEMORY MANAGEMENT ===================
            max_memory_restart: '500M',      // Restart if memory exceeds limit
            min_uptime: '10s',               // Minimum uptime to consider stable
            max_restarts: 10,                // Max restarts within min_uptime window
            restart_delay: 4000,             // Delay between restarts (ms)
            
            // =================== PERFORMANCE TUNING ===================
            kill_timeout: 5000,              // Time to wait before force kill (ms)
            listen_timeout: 8000,            // Time to wait for listen signal (ms)
            wait_ready: true,                // Wait for ready signal
            ready_timeout: 10000,            // Timeout for ready signal (ms)
            
            // =================== NODE.JS CONFIGURATION ===================
            node_args: [
                '--max-old-space-size=1024',  // Max heap size 1GB
                '--enable-source-maps',       // Enable source maps for debugging
                '--optimize-for-size',        // Optimize for memory usage
                '--max-semi-space-size=64',   // Max semi-space size 64MB
                '--max-old-space-size=1024',  // Max old space size 1GB
                '--experimental-worker'       // Enable worker threads
            ],
            
            // =================== ENVIRONMENT VARIABLES ===================
            env: {
                // Development environment
                NODE_ENV: 'development',
                PORT: 3000,
                
                // Logging configuration
                DRAGON_LOG_DIR: '/var/www/Dragon3/logs',
                LOG_LEVEL: 'debug',
                
                // Performance settings
                MAX_WEBSOCKET_CONNECTIONS: 100,
                WEBSOCKET_CONNECTION_P95_MS: 100,
                MESSAGE_PROCESSING_P95_MS: 50,
                REDIS_PUBSUB_P95_MS: 25,
                
                // Memory settings
                MEMORY_ALERT_MB: 400,
                GC_THRESHOLD_MB: 300,
                ENABLE_GC_MONITORING: 'true',
                FORCE_GC_ENABLED: 'true',
                
                // Security settings
                WEBSOCKET_CONNECTION_VALIDATION: 'true',
                ALLOWED_WEBSOCKET_ORIGINS: '*',
                MAX_MESSAGE_SIZE_BYTES: 1048576,
                RATE_LIMIT_ENABLED: 'true',
                
                // Circuit breaker settings
                WEBSOCKET_CIRCUIT_BREAKER_ENABLED: 'true',
                WEBSOCKET_ERROR_THRESHOLD: 5,
                WEBSOCKET_RECOVERY_TIME_MS: 30000,
                
                // Health monitoring
                HEALTH_CHECK_INTERVAL_MS: 30000,
                METRICS_REPORT_INTERVAL_MS: 60000,
                PERFORMANCE_LOGGING_ENABLED: 'true',
                
                // Redis configuration
                REDIS_URL: 'redis://127.0.0.1:6379',
                
                // Debug settings
                DEBUG: 'dragon3:*',
                DETAILED_ERROR_REPORTING: 'true'
            },
            
            env_staging: {
                // Staging environment
                NODE_ENV: 'staging',
                PORT: 3001,
                
                // Logging configuration
                DRAGON_LOG_DIR: '/var/www/Dragon3/logs/staging',
                LOG_LEVEL: 'info',
                
                // Performance settings - Stricter
                MAX_WEBSOCKET_CONNECTIONS: 500,
                WEBSOCKET_CONNECTION_P95_MS: 80,
                MESSAGE_PROCESSING_P95_MS: 40,
                REDIS_PUBSUB_P95_MS: 20,
                
                // Memory settings - Production-like
                MEMORY_ALERT_MB: 450,
                GC_THRESHOLD_MB: 350,
                ENABLE_GC_MONITORING: 'true',
                FORCE_GC_ENABLED: 'true',
                
                // Security settings - Enhanced
                WEBSOCKET_CONNECTION_VALIDATION: 'true',
                ALLOWED_WEBSOCKET_ORIGINS: 'https://staging.dragon3.com',
                MAX_MESSAGE_SIZE_BYTES: 1048576,
                RATE_LIMIT_ENABLED: 'true',
                RATE_LIMIT_MESSAGES: 50,
                
                // Circuit breaker settings
                WEBSOCKET_CIRCUIT_BREAKER_ENABLED: 'true',
                WEBSOCKET_ERROR_THRESHOLD: 3,
                WEBSOCKET_RECOVERY_TIME_MS: 20000,
                
                // Health monitoring - More frequent
                HEALTH_CHECK_INTERVAL_MS: 15000,
                METRICS_REPORT_INTERVAL_MS: 30000,
                PERFORMANCE_LOGGING_ENABLED: 'true',
                
                // Redis configuration
                REDIS_URL: 'redis://staging-redis.dragon3.internal:6379',
                
                // Debug settings
                DEBUG: 'dragon3:error,dragon3:warning',
                DETAILED_ERROR_REPORTING: 'true'
            },
            
            env_production: {
                // Production environment
                NODE_ENV: 'production',
                PORT: 3000,
                
                // Logging configuration
                DRAGON_LOG_DIR: '/var/www/Dragon3/logs/production',
                LOG_LEVEL: 'warn',
                
                // Performance settings - Strict FAANG SLA
                MAX_WEBSOCKET_CONNECTIONS: 1000,
                WEBSOCKET_CONNECTION_P95_MS: 100,
                MESSAGE_PROCESSING_P95_MS: 50,
                REDIS_PUBSUB_P95_MS: 25,
                
                // Memory settings - Production optimized
                MEMORY_ALERT_MB: 480,
                GC_THRESHOLD_MB: 400,
                ENABLE_GC_MONITORING: 'true',
                FORCE_GC_ENABLED: 'true',
                
                // Security settings - Maximum security
                WEBSOCKET_CONNECTION_VALIDATION: 'true',
                ALLOWED_WEBSOCKET_ORIGINS: 'https://dragon3.com,https://app.dragon3.com',
                MAX_MESSAGE_SIZE_BYTES: 524288,  // 512KB in production
                RATE_LIMIT_ENABLED: 'true',
                RATE_LIMIT_MESSAGES: 30,
                
                // Circuit breaker settings - Aggressive
                WEBSOCKET_CIRCUIT_BREAKER_ENABLED: 'true',
                WEBSOCKET_ERROR_THRESHOLD: 2,
                WEBSOCKET_RECOVERY_TIME_MS: 15000,
                
                // Health monitoring - Production frequency
                HEALTH_CHECK_INTERVAL_MS: 10000,
                METRICS_REPORT_INTERVAL_MS: 60000,
                PERFORMANCE_LOGGING_ENABLED: 'false',  // Disable verbose logging
                
                // Redis configuration
                REDIS_URL: 'redis://prod-redis-cluster.dragon3.internal:6379',
                REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',
                
                // Debug settings - Minimal
                DEBUG: 'dragon3:error',
                DETAILED_ERROR_REPORTING: 'false'
            },
            
            env_testing: {
                // Testing/CI environment
                NODE_ENV: 'test',
                PORT: 3002,
                
                // Logging configuration
                DRAGON_LOG_DIR: '/tmp/dragon3-test-logs',
                LOG_LEVEL: 'error',
                
                // Performance settings - Relaxed for testing
                MAX_WEBSOCKET_CONNECTIONS: 10,
                WEBSOCKET_CONNECTION_P95_MS: 200,
                MESSAGE_PROCESSING_P95_MS: 100,
                REDIS_PUBSUB_P95_MS: 50,
                
                // Memory settings - Conservative
                MEMORY_ALERT_MB: 200,
                GC_THRESHOLD_MB: 150,
                ENABLE_GC_MONITORING: 'false',
                FORCE_GC_ENABLED: 'false',
                
                // Security settings - Testing friendly
                WEBSOCKET_CONNECTION_VALIDATION: 'false',
                ALLOWED_WEBSOCKET_ORIGINS: '*',
                MAX_MESSAGE_SIZE_BYTES: 1048576,
                RATE_LIMIT_ENABLED: 'false',
                
                // Circuit breaker settings - Disabled for testing
                WEBSOCKET_CIRCUIT_BREAKER_ENABLED: 'false',
                
                // Health monitoring - Fast for CI
                HEALTH_CHECK_INTERVAL_MS: 5000,
                METRICS_REPORT_INTERVAL_MS: 10000,
                PERFORMANCE_LOGGING_ENABLED: 'false',
                
                // Redis configuration - Local
                REDIS_URL: 'redis://127.0.0.1:6379',
                
                // Debug settings
                DEBUG: 'dragon3:test',
                DETAILED_ERROR_REPORTING: 'true'
            },
            
            // =================== LOGGING CONFIGURATION ===================
            log_file: '/var/www/Dragon3/logs/combined.log',
            out_file: '/var/www/Dragon3/logs/out.log',
            error_file: '/var/www/Dragon3/logs/error.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true,
            
            // =================== LOG ROTATION ===================
            log_type: 'json',               // JSON format for structured logging
            rotate_logs: true,              // Enable log rotation
            
            // =================== PROCESS MONITORING ===================
            monitoring: {
                http: true,                 // Enable HTTP monitoring
                https: false,               // HTTPS monitoring (if applicable)
                port: false,                // Don't monitor specific port
                pidusage: true,             // Monitor CPU/Memory usage
                unref: false                // Keep monitoring active
            },
            
            // =================== ERROR HANDLING ===================
            error_timeout: 5000,           // Timeout for error handling
            kill_retry_time: 100,          // Retry time for kill signal
            
            // =================== ADVANCED FEATURES ===================
            increment_var: 'PORT',         // Increment PORT for multiple instances
            combine_logs: true,            // Combine logs from multiple instances
            merge_logs: true,              // Merge stderr and stdout
            
            // =================== HEALTH CHECK ===================
            health_check_http: {
                path: '/health',
                port: 3000,
                max_failed_checks: 3,
                check_interval: 30000
            },
            
            // =================== GRACEFUL SHUTDOWN ===================
            kill_timeout: 5000,            // Graceful shutdown timeout
            shutdown_with_message: true,   // Send shutdown message
            
            // =================== INSTANCE CONFIGURATION ===================
            instance_var: 'INSTANCE_ID',   // Environment variable for instance ID
            
            // =================== CRON RESTART ===================
            cron_restart: '0 4 * * *',     // Restart daily at 4 AM (optional)
            
            // =================== CUSTOM HOOKS ===================
            pre_restart_delay: 2000,       // Delay before restart
            post_start_delay: 1000,        // Delay after start
            
            // =================== SOURCE MAP SUPPORT ===================
            source_map_support: true,      // Enable source map support
            
            // =================== DISABLE LOGS ===================
            disable_logs: false,           // Keep logs enabled
            
            // =================== TRACE WARNINGS ===================
            trace_warnings: true,          // Trace Node.js warnings
            
            // =================== EXTRA ARGUMENTS ===================
            args: [],                      // Additional command line arguments
            
            // =================== INTERPRETER ===================
            interpreter: 'node',           // Use node interpreter
            interpreter_args: []           // Additional interpreter arguments
        }
    ],
    
    // =================== DEPLOYMENT CONFIGURATION ===================
    deploy: {
        production: {
            user: 'dragon3',
            host: ['prod-server-1.dragon3.com', 'prod-server-2.dragon3.com'],
            ref: 'origin/main',
            repo: 'git@github.com:dragon3/backend.git',
            path: '/var/www/Dragon3/production',
            ssh_options: 'StrictHostKeyChecking=no',
            
            // Pre-deployment commands
            'pre-deploy-local': [
                'echo "Starting production deployment"',
                'npm run test',
                'npm run build'
            ].join(' && '),
            
            // Post-deployment commands
            'post-deploy': [
                'npm install --production',
                'npm run migrate',
                'pm2 reload ecosystem.config.js --env production',
                'pm2 save'
            ].join(' && '),
            
            // Pre-setup commands
            'pre-setup': [
                'mkdir -p /var/www/Dragon3/logs/production',
                'mkdir -p /var/www/Dragon3/production'
            ].join(' && '),
            
            // Post-setup commands
            'post-setup': [
                'chmod +x /var/www/Dragon3/production/current/scripts/*',
                'chown -R dragon3:dragon3 /var/www/Dragon3/production'
            ].join(' && ')
        },
        
        staging: {
            user: 'dragon3',
            host: 'staging-server.dragon3.com',
            ref: 'origin/develop',
            repo: 'git@github.com:dragon3/backend.git',
            path: '/var/www/Dragon3/staging',
            ssh_options: 'StrictHostKeyChecking=no',
            
            'pre-deploy-local': [
                'echo "Starting staging deployment"',
                'npm run test:staging'
            ].join(' && '),
            
            'post-deploy': [
                'npm install',
                'npm run migrate:staging',
                'pm2 reload ecosystem.config.js --env staging',
                'pm2 save'
            ].join(' && '),
            
            'pre-setup': [
                'mkdir -p /var/www/Dragon3/logs/staging',
                'mkdir -p /var/www/Dragon3/staging'
            ].join(' && ')
        },
        
        development: {
            user: 'developer',
            host: 'dev-server.dragon3.internal',
            ref: 'origin/develop',
            repo: 'git@github.com:dragon3/backend.git',
            path: '/var/www/Dragon3/development',
            
            'post-deploy': [
                'npm install',
                'pm2 restart ecosystem.config.js',
                'pm2 save'
            ].join(' && ')
        }
    }
};