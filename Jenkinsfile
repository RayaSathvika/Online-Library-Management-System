
pipeline {
    agent any

    options {
        timestamps()
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                bat 'node --version'
                bat 'npm --version'
                bat 'npm ci'
            }
        }

        stage('Run Tests') {
            steps {
                bat 'npm test'
            }
        }
    }

    post {
        success {
            echo 'Online Library Management System pipeline completed successfully!'
        }

        failure {
            echo 'Pipeline failed. Please check the console output.'
        }

        always {
            echo 'Jenkins pipeline execution finished.'
        }
    }
}
