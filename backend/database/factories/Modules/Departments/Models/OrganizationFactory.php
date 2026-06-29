<?php

declare(strict_types=1);

namespace Database\Factories\Modules\Departments\Models;

use App\Modules\Departments\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Organization>
 */
class OrganizationFactory extends Factory
{
    protected $model = Organization::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'code' => $this->faker->unique()->slug(2),
            'name' => $this->faker->company(),
            'legal_name' => $this->faker->company().' Municipal Corporation',
            'domain' => $this->faker->domainName(),
            'contact' => [
                'email' => $this->faker->companyEmail(),
                'phone' => $this->faker->e164PhoneNumber(),
                'address' => $this->faker->address(),
            ],
            'branding' => [
                'logo_url' => 'https://cdn.example.com/logos/'.$this->faker->uuid().'.png',
                'primary_color' => '#0F62FE',
                'secondary_color' => '#08BDBA',
            ],
            'storage_quota_mb' => 5120,
            'settings' => ['locale' => 'en'],
            'active' => true,
        ];
    }
}
