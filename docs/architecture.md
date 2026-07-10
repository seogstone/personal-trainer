# Architecture

The app is a monorepo with a Next.js dashboard, persistent Node worker, Python MyFitnessPal collector, shared normalized types, analytics functions and Supabase migrations.

Dashboard components consume normalized application data only. Provider details live behind adapters in the worker so Totem, Hevy and MyFitnessPal can be replaced independently.
