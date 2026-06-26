<?php

declare(strict_types=1);

namespace Database\Factories\Modules\Reports\Models;

use App\Modules\Reports\Models\ReportType;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<ReportType>
 */
class ReportTypeFactory extends Factory
{
    protected $model = ReportType::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = $this->faker->unique()->word();

        return [
            'name' => ucfirst($name),
            'code' => Str::slug($name).'-'.Str::lower(Str::random(4)),
            'description' => $this->faker->sentence(),
            'icon' => 'icon-'.Str::lower($name),
            'color' => '#'.Str::upper(Str::random(6)),
            'requires_video' => false,
            'requires_photo' => true,
            'min_photos' => 1,
            'max_photos' => 5,
            'validation_rules' => null,
            'active' => true,
        ];
    }
}
